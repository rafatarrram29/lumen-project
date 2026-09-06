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
  line: string | null;
  // Optional: a per-row identifier (Customer ID, invoice/transaction
  // number — whatever the source file has) that tells a genuinely
  // repeated row apart from two DIFFERENT rows that simply happen to
  // share the same area/item/month/value/qty (e.g. two different
  // customers ordering the same common quantity at the same list price —
  // completely normal in real multi-customer sales data, and NOT a
  // duplicate). Only when this is mapped can an exact-repeat check safely
  // auto-remove duplicates on upload instead of asking; unmapped, that
  // check has no way to distinguish the two cases and must keep asking.
  uniqueId: string | null;
};

export type ParsedSalesRow = {
  area: string;
  item: string;
  family: string;
  salesQty: number | null;
  salesValue: number;
  month: number;
  rep: string | null;
  line: string | null;
  uniqueId: string | null;
};

export type RawSheet = {
  headers: string[];
  rows: Record<string, unknown>[];
  // Same rows, but every cell read as its rendered display text (SheetJS's
  // cell.w) instead of the underlying value — populated only for real
  // spreadsheet uploads (readWorkbookSheet.ts). Absent for PDF-derived
  // sheets (tableToRawSheet), which have no separate "raw value vs display
  // text" distinction to begin with: PDF cells are already plain text.
  displayRows?: Record<string, unknown>[];
};

// A text-designated field (item/area/rep/line/product/company — never a
// number/date/share field) should show exactly what the file displays, not
// a numeric reinterpretation of it. A spreadsheet cell holding something
// like "25/500" or "007" can get auto-typed as a number by Excel or by
// plaintext/CSV parsing, at which point the underlying raw value has
// nothing to do with the text as written (see readWorkbookSheet.ts) — the
// sheet's own rendered display text (displayRows) is the literal, as-typed
// value and always wins when available.
export function textCellValue(sheet: RawSheet, rowIndex: number, key: string, rawValue: unknown): string {
  const display = sheet.displayRows?.[rowIndex]?.[key];
  return String(display ?? rawValue).trim();
}

// A cell formatted as Excel's "Percentage" number type stores its raw value
// (what `rows`/parseNumeric would read) as a FRACTION — 1.3962 for a cell
// that displays "139.62%" — while the rendered display text already carries
// the correct, human-scaled number. Reading the raw value for a percentage
// field is therefore off by a factor of 100 whenever the source cell used
// real Percentage formatting (as opposed to someone just typing "139.62" or
// "139.62%" into a plain cell, where raw and display agree). Preferring
// display text — stripping a trailing "%" — sidesteps the ambiguity instead
// of trying to detect the cell's number format.
export function percentCellValue(sheet: RawSheet, rowIndex: number, key: string, rawValue: unknown): number | null {
  const display = sheet.displayRows?.[rowIndex]?.[key];
  if (typeof display === "string" && display.trim() !== "") {
    const parsed = parseNumeric(display.trim().replace(/%\s*$/, ""));
    if (!Number.isNaN(parsed)) return parsed;
  }
  const parsed = parseNumeric(rawValue);
  return Number.isNaN(parsed) ? null : parsed;
}

export type TargetColumnMapping = {
  area: string | null;
  rep: string | null;
  item: string | null;
  month: string;
  value: string;
  /**
   * The plan file's own achievement percentage, when it carries one.
   * Optional on the type as well as nullable, because mappings saved
   * before this column existed simply do not have the key — reading one
   * back must not turn into "the user un-mapped it".
   */
  achPct?: string | null;
};

export type ParsedTargetRow = {
  area: string | null;
  rep: string | null;
  item: string | null;
  month: number;
  targetValue: number;
  /** From the file, if it had an Ach% column. Never used in place of the
   *  value Lumen computes — see targetProgress.ts. */
  achPct: number | null;
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
  // "line" itself is deliberately not a guess keyword — it's too generic
  // and would false-match an unrelated column like "Product Line".
  { field: "line", keywords: ["group", "district", "zone"] },
  // Deliberately specific ("customer id", not bare "customer") so this
  // never guesses a customer NAME column instead of an actual identifier
  // — a name isn't reliably unique the way an ID/invoice number is.
  { field: "uniqueId", keywords: ["customer id", "customer no", "customer code", "invoice no", "invoice number", "invoice", "transaction id", "row id"] },
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

/**
 * Header text, flattened enough to compare: separators become spaces, so
 * "FCT_Val", "FCT-Val" and "FCT  Val" all read as "fct val". Percent signs
 * survive, because "Ach %" is a name people actually use.
 */
function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[_\-./\\]+/g, " ")
    .replace(/\s+/g, " ");
}

const SUBSTRING_MIN = 4;

/**
 * How well one header answers to one keyword.
 *
 *   exact  "Month" for "month"          — unambiguous
 *   word   "BU Rep" for "rep"           — the keyword is a word in the name
 *   part   "FCTVal" for "forecast"      — a bare substring, and the reason
 *                                          short keywords are barred from it
 *
 * The substring floor is what stopped "Report Month" being read as the rep
 * column: "rep" appears inside "report", and the old scorer took it, then
 * had nothing left for Month. Only keywords of four characters or more may
 * match without a word boundary.
 */
function keywordScore(normalized: string, keyword: string): number {
  if (normalized === keyword) return 1000 + keyword.length;
  const bounded = new RegExp(`(^| )${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`);
  if (bounded.test(normalized)) return 100 + keyword.length;
  if (keyword.length >= SUBSTRING_MIN && normalized.includes(keyword)) return keyword.length;
  return 0;
}

type ScoredRule<K extends string> = {
  field: K;
  keywords: string[];
  /** Words that make a match more likely to be the right column, not another. */
  bonus?: string[];
};

/**
 * Match headers to fields, best pairing first.
 *
 * The old version walked the fields in order and let each take its own best
 * remaining header. That let an early field with a weak match take a header
 * a later field needed exactly — "Report Month" going to Rep, leaving Month
 * unmapped. Scoring every pairing and then assigning the strongest first
 * means a confident match always wins over a vague one, whichever field
 * happens to be declared first.
 */
function guessByScore<K extends string>(rules: ScoredRule<K>[], headers: string[]): Partial<Record<K, string>> {
  const pairs: { field: K; header: string; score: number; rank: number }[] = [];

  rules.forEach((rule, ruleIndex) => {
    headers.forEach((header, headerIndex) => {
      const normalized = normalizeHeader(header);
      let best = 0;
      for (const keyword of rule.keywords) best = Math.max(best, keywordScore(normalized, keyword));
      if (best === 0) return;
      // A qualifier like "Val" separates "FCT Val" from a bare "FCT", and
      // "Target Value" from "Target Ach %".
      const bonus = (rule.bonus ?? []).some((b) => keywordScore(normalized, b) > 0) ? 25 : 0;
      pairs.push({ field: rule.field, header, score: best + bonus, rank: ruleIndex * 1000 + headerIndex });
    });
  });

  // Deterministic: equal scores fall back to declaration order, so the same
  // file always maps the same way.
  pairs.sort((a, b) => b.score - a.score || a.rank - b.rank);

  const guess: Partial<Record<K, string>> = {};
  const takenHeaders = new Set<string>();
  for (const pair of pairs) {
    if (guess[pair.field] !== undefined || takenHeaders.has(pair.header)) continue;
    guess[pair.field] = pair.header;
    takenHeaders.add(pair.header);
  }
  return guess;
}

/**
 * The vocabulary a targets file is likely to use. Wider than the sales
 * one on purpose: a plan file is exported from whatever tool made the plan,
 * so its column names vary far more than a sales export's do.
 */
const TARGET_GUESS_RULES: ScoredRule<keyof TargetColumnMapping>[] = [
  { field: "area", keywords: ["area", "region", "governorate", "gov", "territory", "district", "city"] },
  { field: "rep", keywords: ["rep", "bu rep", "medical rep", "representative", "salesperson", "agent"] },
  { field: "item", keywords: ["item", "parent item", "product", "sku", "brand", "material"] },
  { field: "month", keywords: ["month", "period"] },
  {
    field: "value",
    keywords: ["fct val", "fct value", "target value", "forecast value", "fct", "forecast", "target", "plan", "budget", "goal", "quota"],
    bonus: ["val", "value", "amount"],
  },
  { field: "achPct", keywords: ["ach %", "ach%", "ach", "achievement", "achieved", "attainment"] },
];

export function guessTargetMapping(headers: string[]): Partial<Record<keyof TargetColumnMapping, string>> {
  return guessByScore(TARGET_GUESS_RULES, headers);
}

export function applyTargetMapping(
  sheet: RawSheet,
  mapping: TargetColumnMapping,
): { rows: ParsedTargetRow[]; skipped: SkippedRowInfo } {
  const rows: ParsedTargetRow[] = [];
  const examples: string[] = [];
  let skippedCount = 0;

  sheet.rows.forEach((r, i) => {
    const monthVal = r[mapping.month];
    const valueVal = r[mapping.value];
    if (monthVal == null || valueVal == null) {
      skippedCount++;
      return;
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
      return;
    }

    const areaVal = mapping.area ? r[mapping.area] : null;
    const repVal = mapping.rep ? r[mapping.rep] : null;
    const itemVal = mapping.item ? r[mapping.item] : null;

    // An unreadable Ach% is dropped rather than skipping the row: the
    // target value is the number that matters, and the percentage is a
    // cross-check Lumen can compute for itself anyway.
    const achRaw = mapping.achPct ? r[mapping.achPct] : null;
    const achPct = achRaw != null ? percentCellValue(sheet, i, mapping.achPct!, achRaw) : null;

    rows.push({
      area: areaVal != null ? textCellValue(sheet, i, mapping.area!, areaVal) : null,
      rep: repVal != null ? textCellValue(sheet, i, mapping.rep!, repVal) : null,
      item: itemVal != null ? textCellValue(sheet, i, mapping.item!, itemVal) : null,
      month,
      targetValue,
      achPct,
    });
  });

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

  sheet.rows.forEach((r, i) => {
    const areaVal = r[mapping.area];
    const itemVal = r[mapping.item];
    const valueVal = r[mapping.value];
    const monthVal = r[mapping.month];
    if (areaVal == null || itemVal == null || valueVal == null || monthVal == null) {
      skippedCount++;
      return;
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
      return;
    }

    // Read as the file's own displayed text (not a numeric reinterpretation
    // of the cell) and trimmed, so a stray leading/trailing space on just
    // some rows of an otherwise-identical area/item/rep name doesn't
    // silently split it into a second, near-invisible bucket in the report
    // (e.g. "Domiat 1" vs "Domiat 1 " being treated as two different areas).
    const item = textCellValue(sheet, i, mapping.item, itemVal);
    const qtyRaw = mapping.qty ? r[mapping.qty] : null;
    const repRaw = mapping.rep ? r[mapping.rep] : null;
    const lineRaw = mapping.line ? r[mapping.line] : null;
    const uniqueIdRaw = mapping.uniqueId ? r[mapping.uniqueId] : null;
    const qty = qtyRaw != null ? parseNumeric(qtyRaw) : NaN;

    rows.push({
      area: textCellValue(sheet, i, mapping.area, areaVal),
      item,
      family: item,
      salesQty: !Number.isNaN(qty) ? qty : null,
      salesValue,
      month,
      rep: repRaw != null ? textCellValue(sheet, i, mapping.rep!, repRaw) : null,
      line: lineRaw != null ? textCellValue(sheet, i, mapping.line!, lineRaw) : null,
      uniqueId: uniqueIdRaw != null ? textCellValue(sheet, i, mapping.uniqueId!, uniqueIdRaw) : null,
    });
  });

  if (rows.length === 0) {
    throw new Error("No usable rows found after applying the column mapping.");
  }

  return { rows, skipped: { count: skippedCount, examples } };
}
