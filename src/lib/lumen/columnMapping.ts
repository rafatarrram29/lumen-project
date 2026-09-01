// Generic sales-file ingestion: no fixed column names or file layout is
// assumed. Reading a file is two steps — find its header row and hand back
// the raw column names (readWorkbookSheet, in its own file so the `xlsx`
// library it needs isn't pulled into every bundle that just wants these
// types or the pure mapping functions below), then turn those raw rows
// into normalized records once the caller supplies a mapping from this
// dataset's own column names to the engine's fields (applyColumnMapping).

export type ColumnMapping = {
  area: string;
  item: string;
  value: string;
  qty: string | null;
  month: string;
  rep: string | null;
  cluster: string | null;
};

export type ParsedSalesRow = {
  area: string;
  item: string;
  family: string;
  salesQty: number | null;
  salesValue: number;
  month: number;
  rep: string | null;
  cluster: string | null;
};

export type RawSheet = {
  headers: string[];
  rows: Record<string, unknown>[];
};

export type TargetColumnMapping = {
  area: string | null;
  rep: string | null;
  item: string | null;
  month: string;
  value: string;
};

export type ParsedTargetRow = {
  area: string | null;
  rep: string | null;
  item: string | null;
  month: number;
  targetValue: number;
};

export type Dataset = {
  id: string;
  name: string;
  columnMapping: ColumnMapping;
  targetColumnMapping: TargetColumnMapping | null;
  createdAt: string;
  userId: string | null;
};

// Rows dropped while applying a mapping (missing a required field, or a
// month/value cell that couldn't be read as a number) used to vanish with
// no trace — the report would just be quietly short some rows. Callers now
// get a count plus a few examples so an upload can surface a warning
// instead of silently under-counting.
export type SkippedRowInfo = { count: number; examples: string[] };

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_ARABIC_INDIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

// Number() alone fails silently on very common real-world spreadsheet
// formatting: Arabic-Indic digits (input regional settings), and
// thousands-separator commas (e.g. a value exported as text "56,996").
// Both would previously make a perfectly valid row disappear from the
// upload with no warning at all.
export function parseNumeric(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (raw == null) return NaN;
  let s = String(raw).trim();
  if (s === "") return NaN;
  s = s.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC_DIGITS.indexOf(d)));
  s = s.replace(/[۰-۹]/g, (d) => String(EXTENDED_ARABIC_INDIC_DIGITS.indexOf(d)));
  s = s.replace(/,/g, "");
  return Number(s);
}

type GuessRule = { field: keyof ColumnMapping; keywords: string[] };

// Best-effort pre-fill for the mapping step, so most files just need a
// glance and confirm rather than mapping six columns by hand every time.
const GUESS_RULES: GuessRule[] = [
  { field: "area", keywords: ["area", "region", "territory"] },
  { field: "item", keywords: ["item", "product", "sku", "material"] },
  { field: "value", keywords: ["sales value", "value", "revenue", "amount", "sales"] },
  { field: "qty", keywords: ["sales qty", "quantity", "qty", "units"] },
  { field: "month", keywords: ["month", "period"] },
  { field: "rep", keywords: ["rep", "representative", "salesperson", "agent"] },
  { field: "cluster", keywords: ["cluster", "group", "district", "zone"] },
];

export function guessMapping(headers: string[]): Partial<Record<keyof ColumnMapping, string>> {
  const guess: Partial<Record<keyof ColumnMapping, string>> = {};
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

const TARGET_GUESS_RULES: GuessRule[] = [
  { field: "area", keywords: ["area", "region", "territory"] },
  { field: "rep", keywords: ["rep", "representative", "salesperson", "agent"] },
  { field: "item", keywords: ["item", "product", "sku", "material"] },
  { field: "month", keywords: ["month", "period"] },
  { field: "value", keywords: ["target value", "target", "goal", "quota"] },
];

export function guessTargetMapping(headers: string[]): Partial<Record<keyof TargetColumnMapping, string>> {
  const guess: Partial<Record<keyof TargetColumnMapping, string>> = {};
  const used = new Set<string>();

  for (const rule of TARGET_GUESS_RULES) {
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
      guess[rule.field as keyof TargetColumnMapping] = best;
      used.add(best);
    }
  }

  return guess;
}

export function applyTargetMapping(
  sheet: RawSheet,
  mapping: TargetColumnMapping,
): { rows: ParsedTargetRow[]; skipped: SkippedRowInfo } {
  const rows: ParsedTargetRow[] = [];
  const examples: string[] = [];
  let skippedCount = 0;

  for (const r of sheet.rows) {
    const monthVal = r[mapping.month];
    const valueVal = r[mapping.value];
    if (monthVal == null || valueVal == null) {
      skippedCount++;
      continue;
    }

    const month = Math.trunc(parseNumeric(monthVal));
    const targetValue = parseNumeric(valueVal);
    if (Number.isNaN(month) || Number.isNaN(targetValue)) {
      skippedCount++;
      if (examples.length < 5) {
        examples.push(
          Number.isNaN(targetValue) ? `could not read value "${valueVal}" as a number` : `could not read month "${monthVal}" as a number`,
        );
      }
      continue;
    }

    const areaVal = mapping.area ? r[mapping.area] : null;
    const repVal = mapping.rep ? r[mapping.rep] : null;
    const itemVal = mapping.item ? r[mapping.item] : null;

    rows.push({
      area: areaVal != null ? String(areaVal).trim() : null,
      rep: repVal != null ? String(repVal).trim() : null,
      item: itemVal != null ? String(itemVal).trim() : null,
      month,
      targetValue,
    });
  }

  if (rows.length === 0) {
    throw new Error("No usable rows found after applying the target column mapping.");
  }

  return { rows, skipped: { count: skippedCount, examples } };
}

export function applyColumnMapping(
  sheet: RawSheet,
  mapping: ColumnMapping,
): { rows: ParsedSalesRow[]; skipped: SkippedRowInfo } {
  const rows: ParsedSalesRow[] = [];
  const examples: string[] = [];
  let skippedCount = 0;

  for (const r of sheet.rows) {
    const areaVal = r[mapping.area];
    const itemVal = r[mapping.item];
    const valueVal = r[mapping.value];
    const monthVal = r[mapping.month];
    if (areaVal == null || itemVal == null || valueVal == null || monthVal == null) {
      skippedCount++;
      continue;
    }

    const salesValue = parseNumeric(valueVal);
    const month = Math.trunc(parseNumeric(monthVal));
    if (Number.isNaN(salesValue) || Number.isNaN(month)) {
      skippedCount++;
      if (examples.length < 5) {
        examples.push(
          Number.isNaN(salesValue) ? `could not read value "${valueVal}" as a number` : `could not read month "${monthVal}" as a number`,
        );
      }
      continue;
    }

    // Trimmed so a stray leading/trailing space on just some rows of an
    // otherwise-identical area/item/rep name doesn't silently split it
    // into a second, near-invisible bucket in the report (e.g. "Domiat 1"
    // vs "Domiat 1 " being treated as two different areas).
    const item = String(itemVal).trim();
    const qtyRaw = mapping.qty ? r[mapping.qty] : null;
    const repRaw = mapping.rep ? r[mapping.rep] : null;
    const clusterRaw = mapping.cluster ? r[mapping.cluster] : null;
    const qty = qtyRaw != null ? parseNumeric(qtyRaw) : NaN;

    rows.push({
      area: String(areaVal).trim(),
      item,
      family: item,
      salesQty: !Number.isNaN(qty) ? qty : null,
      salesValue,
      month,
      rep: repRaw != null ? String(repRaw).trim() : null,
      cluster: clusterRaw != null ? String(clusterRaw).trim() : null,
    });
  }

  if (rows.length === 0) {
    throw new Error("No usable rows found after applying the column mapping.");
  }

  return { rows, skipped: { count: skippedCount, examples } };
}
