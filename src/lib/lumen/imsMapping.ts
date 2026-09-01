// IMS / Market Insights file ingestion — same two-step shape as the sales
// file (columnMapping.ts): read the sheet, then turn its rows into
// normalized records once the caller supplies a mapping from this file's
// own column names to what they mean. Entirely separate types/tables from
// the sales pipeline; this never touches lumen_sales_records.
//
// Unlike the sales mapping, area and product are both OPTIONAL here — a
// real IMS export is often organized by product/market with no geography
// column at all (or, less often, by area with no product breakdown). At
// least one of the two is required (there has to be SOME entity a market
// share value is attached to), but which one is up to the file. A PDF
// export goes through this exact same mapping — tableToRawSheet below
// turns one extracted table (see pdfTableExtract.ts, deliberately not
// imported here — that module pulls in pdfjs-dist, a Node-only library
// that has no business in the client bundle) into a RawSheet, so nothing
// downstream of "give me a RawSheet" needs to know whether the file was a
// spreadsheet or a PDF.
import { parseNumeric, type RawSheet } from "./columnMapping";
import type { SkippedRowInfo } from "./columnMapping";

export type ImsColumnMapping = {
  area: string | null;
  product: string | null;
  marketShare: string;
  month: string;
  company: string | null;
};

export type ParsedImsRow = {
  area: string | null;
  product: string | null;
  company: string | null;
  marketShare: number;
  month: number;
};

type GuessRule = { field: keyof ImsColumnMapping; keywords: string[] };

const GUESS_RULES: GuessRule[] = [
  { field: "area", keywords: ["area", "region", "territory"] },
  { field: "product", keywords: ["product", "item", "molecule", "brand", "sku"] },
  { field: "marketShare", keywords: ["market share", "share", "ms%", "ms %", "ms"] },
  { field: "month", keywords: ["month", "period"] },
  { field: "company", keywords: ["company", "manufacturer", "competitor", "player"] },
];

export function guessImsMapping(headers: string[]): Partial<Record<keyof ImsColumnMapping, string>> {
  const guess: Partial<Record<keyof ImsColumnMapping, string>> = {};
  const used = new Set<string>();

  for (const rule of GUESS_RULES) {
    let best: string | null = null;
    let bestScore = 0;
    for (const header of headers) {
      if (used.has(header)) continue;
      const normalized = header.trim().toLowerCase();
      for (const keyword of rule.keywords) {
        const score = normalized === keyword ? keyword.length + 1000 : normalized.includes(keyword) ? keyword.length : 0;
        if (score > bestScore) {
          best = header;
          bestScore = score;
        }
      }
    }
    if (best) {
      guess[rule.field] = best;
      used.add(best);
    }
  }

  return guess;
}

export function isValidImsMapping(mapping: {
  area: string | null;
  product: string | null;
  marketShare: string | null;
  month: string | null;
}): boolean {
  return Boolean((mapping.area || mapping.product) && mapping.marketShare && mapping.month);
}

// A market-share value can come in as "23.4", "23.4%", or (rarely) already
// a fraction like 0.234 — normalized to a 0-100 percentage either way, on
// top of the same Arabic-Indic/comma handling parseNumeric already does.
function parseShare(raw: unknown): number {
  const cleaned = typeof raw === "string" ? raw.replace("%", "").trim() : raw;
  const n = parseNumeric(cleaned);
  if (Number.isNaN(n)) return NaN;
  return n > 0 && n <= 1 ? n * 100 : n;
}

export function applyImsMapping(
  sheet: RawSheet,
  mapping: ImsColumnMapping,
): { rows: ParsedImsRow[]; skipped: SkippedRowInfo } {
  if (!isValidImsMapping(mapping)) {
    throw new Error("At least one of Area or Product, plus Market share and Month, must be mapped.");
  }

  const rows: ParsedImsRow[] = [];
  const examples: string[] = [];
  let skippedCount = 0;

  for (const r of sheet.rows) {
    const areaVal = mapping.area ? r[mapping.area] : null;
    const productVal = mapping.product ? r[mapping.product] : null;
    const shareVal = r[mapping.marketShare];
    const monthVal = r[mapping.month];
    // Only the columns actually mapped are required per row — an
    // unmapped Area/Product is fine (see isValidImsMapping above), but a
    // MAPPED one still has to have a value on this row to keep it.
    if ((mapping.area && areaVal == null) || (mapping.product && productVal == null) || shareVal == null || monthVal == null) {
      skippedCount++;
      continue;
    }

    const marketShare = parseShare(shareVal);
    const month = Math.trunc(parseNumeric(monthVal));
    if (Number.isNaN(marketShare) || Number.isNaN(month)) {
      skippedCount++;
      if (examples.length < 5) {
        examples.push(
          Number.isNaN(marketShare)
            ? `could not read market share "${shareVal}" as a number`
            : `could not read month "${monthVal}" as a number`,
        );
      }
      continue;
    }

    const companyRaw = mapping.company ? r[mapping.company] : null;

    rows.push({
      area: areaVal != null ? String(areaVal).trim() : null,
      product: productVal != null ? String(productVal).trim() : null,
      company: companyRaw != null ? String(companyRaw).trim() : null,
      marketShare,
      month,
    });
  }

  if (rows.length === 0) {
    throw new Error("No usable rows found after applying the IMS column mapping.");
  }

  return { rows, skipped: { count: skippedCount, examples } };
}

// Best-effort guess for which value in the company column is "us" —
// whichever distinct value appears most often (a real IMS export usually
// has our own row for every area/product/month, so it's the most frequent
// company by far when competitors are only listed for some of them).
// Always shown to the user for confirmation, never applied silently.
export function guessOwnCompany(rows: ParsedImsRow[]): string | null {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.company) continue;
    counts.set(r.company, (counts.get(r.company) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

// Turns one extracted PDF table (or a hand-typed manual-entry grid — same
// shape) into the same RawSheet shape a spreadsheet produces, so it goes
// through the exact same guess/mapping/parsing pipeline above. A PDF
// table's own header row can repeat a name (e.g. two "MS" columns, common
// when a slide shows two time periods side by side) — RawSheet rows are
// keyed by header name, so a repeat would silently overwrite the first
// column's values with the second's; renamed here to stay distinct
// instead. Rows are aligned to headers by position, not by count — a row
// with fewer or more cells than the header (extraction isn't always
// perfectly uniform) still keeps whatever aligns instead of being dropped
// entirely; the mapping-step preview is where a genuine misalignment gets
// caught.
export function tableToRawSheet(table: { headers: string[]; rows: string[][] }): RawSheet {
  const seen = new Map<string, number>();
  const headers = table.headers.map((h) => {
    const base = h.trim() || "Column";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });

  const rows = table.rows.map((row) => {
    const record: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (i < row.length) record[h] = row[i];
    });
    return record;
  });

  return { headers, rows };
}
