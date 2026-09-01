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
//
// Month is flexible too: a lot of real IMS material is a snapshot — one
// point in time, not a trend — with no per-row month value at all (a
// comparison table, a single "as of" export). Rather than force every
// file to have a month COLUMN, fixedMonth lets the user state once "this
// whole file is for month N" and have every row use that. The dashboard
// already renders a single-month file fine on its own (the change/vs-
// prior-month column just reads "—" with nothing to compare against) —
// this only removes the requirement to have a real month column to begin
// with, it doesn't add any new display logic.
//
// fixedProduct is the same idea for Product: a real competitor-comparison
// table (e.g. a "Row Labels" column of rival company names for a single
// product/molecule the whole page is about) has no per-row product
// column at all — the product is implied once, by the page/table itself.
// Without this, that "Row Labels" column has nowhere to go but Product,
// which then makes every competitor look like its own unrelated product
// with no company set — exactly why "Top competitor" comes back empty for
// this table shape even though the source file has real competitor data.
import { parseNumeric, type RawSheet } from "./columnMapping";
import type { SkippedRowInfo } from "./columnMapping";

export type ImsColumnMapping = {
  area: string | null;
  product: string | null;
  marketShare: string;
  month: string | null;
  fixedMonth: number | null;
  fixedProduct: string | null;
  company: string | null;
  // Optional: a real IMS comparison table often carries its own growth
  // rate per row (e.g. "GR", "GR R26/R25") — a genuinely different figure
  // (rate of change in the underlying volume) from the share value itself.
  // Left unmapped, growth-based dashboard figures fall back to "not
  // available" rather than being approximated from something else.
  growthRate: string | null;
};

export type ParsedImsRow = {
  area: string | null;
  product: string | null;
  company: string | null;
  marketShare: number;
  month: number;
  growthRate: number | null;
};

type GuessRule = { field: keyof ImsColumnMapping; keywords: string[] };

const GUESS_RULES: GuessRule[] = [
  { field: "area", keywords: ["area", "region", "territory"] },
  // "Row Labels" is Excel PivotTable's own default header for whatever
  // dimension was dragged into the Rows box — never renamed by whoever
  // built the export. A PDF made from a pivoted IQVIA/market-share sheet
  // (the common case) almost always has that dimension be the
  // product/brand, so it's included here as a lower-priority fallback:
  // real keywords like "product" or "brand" still win if present.
  { field: "product", keywords: ["product", "item", "molecule", "brand", "sku", "row labels", "row label"] },
  { field: "marketShare", keywords: ["market share", "share", "ms%", "ms %", "ms"] },
  // Deliberately NOT matching literal month names ("Jan", "Feb", ...) here.
  // Those show up as a WIDE table's own column headers (one column per
  // month, e.g. a pivoted trend export) — a completely different shape
  // from a single "Month" column whose per-row VALUES are a month. Guessing
  // one of those as the Month field would map real sales/share figures
  // into the month slot and silently corrupt every row instead of leaving
  // it for the user to fill in — worse than not guessing at all.
  { field: "month", keywords: ["month", "period", "date"] },
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
  fixedMonth?: number | null;
  fixedProduct?: string | null;
}): boolean {
  return Boolean(
    (mapping.area || mapping.product || mapping.fixedProduct) &&
      mapping.marketShare &&
      (mapping.month || mapping.fixedMonth != null),
  );
}

// A market-share value can come in as "23.4", "23.4%", or (rarely) already
// a fraction like 0.234 — normalized to a 0-100 percentage either way, on
// top of the same Arabic-Indic/comma handling parseNumeric already does.
function parseShare(raw: unknown): number {
  // Whether to treat 0 < n <= 1 as a bare fraction ("0.234" meaning 23.4%)
  // has to be decided from the ORIGINAL text, before the "%" is stripped —
  // once it's gone, "0.1%" (a real, small-but-valid 0.1 percent share) and
  // a bare "0.1" (missing its % sign, really meaning 10%) are indistinguishable,
  // and guessing wrong silently turns a real small competitor's share into
  // 100x its actual value.
  const hadPercentSign = typeof raw === "string" && raw.includes("%");
  const cleaned = typeof raw === "string" ? raw.replace("%", "").trim() : raw;
  const n = parseNumeric(cleaned);
  if (Number.isNaN(n)) return NaN;
  if (hadPercentSign) return n;
  return n > 0 && n <= 1 ? n * 100 : n;
}

// A pivot table's own "Grand Total" (or "Total"/"Subtotal") row is a
// summary of the other rows, not a real product/area/company — keeping it
// as ordinary data would let it outrank every real entry in "top mover" or
// "top competitor" comparisons purely because its numbers are the sum of
// everyone else's. Matched as a whole trimmed cell value, case-insensitive,
// so it never catches a real name that merely contains "total".
const AGGREGATE_LABELS = new Set(["grand total", "total", "subtotal", "totals"]);
function isAggregateLabel(value: string | null): boolean {
  return value !== null && AGGREGATE_LABELS.has(value.toLowerCase());
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
    const monthVal = mapping.month ? r[mapping.month] : null;
    // Only the columns actually mapped are required per row — an
    // unmapped Area/Product is fine (see isValidImsMapping above), but a
    // MAPPED one still has to have a value on this row to keep it. A
    // mapped Month column needs a value per row same as any other; a
    // fixedMonth (no column mapped at all) applies to every row equally,
    // so there's nothing to check per row.
    if (
      (mapping.area && areaVal == null) ||
      (mapping.product && productVal == null) ||
      shareVal == null ||
      (mapping.month && monthVal == null)
    ) {
      skippedCount++;
      continue;
    }

    const areaStr = areaVal != null ? String(areaVal).trim() : null;
    const productStr = productVal != null ? String(productVal).trim() : null;
    if (isAggregateLabel(areaStr) || isAggregateLabel(productStr)) {
      skippedCount++;
      if (examples.length < 5) examples.push(`skipped a "${areaStr ?? productStr}" summary row`);
      continue;
    }

    const marketShare = parseShare(shareVal);
    const month = mapping.month ? Math.trunc(parseNumeric(monthVal)) : mapping.fixedMonth!;
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
    // Optional and best-effort: an unparseable growth-rate cell doesn't
    // invalidate the row (marketShare already carries the row's core
    // meaning) — it just leaves that one figure unavailable for this row.
    const growthRateRaw = mapping.growthRate ? r[mapping.growthRate] : null;
    const growthRateParsed = growthRateRaw != null ? parseShare(growthRateRaw) : null;
    const growthRate = growthRateParsed != null && !Number.isNaN(growthRateParsed) ? growthRateParsed : null;

    rows.push({
      area: areaStr,
      product: productStr ?? mapping.fixedProduct,
      company: companyRaw != null ? String(companyRaw).trim() : null,
      marketShare,
      month,
      growthRate,
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
      // A genuinely blank cell (a pivot table's "Grand Total" row usually
      // has no value in its leading column, e.g. Rank) comes through as ""
      // once cells are aligned by column position rather than array order
      // — normalized to null here so it's treated as "no value" the same
      // way a cell missing from the row entirely would be, instead of as
      // the literal empty string.
      record[h] = i < row.length && row[i] !== "" ? row[i] : null;
    });
    return record;
  });

  return { headers, rows };
}
