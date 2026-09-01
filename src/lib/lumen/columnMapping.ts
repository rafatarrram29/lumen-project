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

export function applyTargetMapping(sheet: RawSheet, mapping: TargetColumnMapping): ParsedTargetRow[] {
  const rows: ParsedTargetRow[] = [];

  for (const r of sheet.rows) {
    const monthVal = r[mapping.month];
    const valueVal = r[mapping.value];
    if (monthVal == null || valueVal == null) continue;

    const month = Math.trunc(Number(monthVal));
    const targetValue = Number(valueVal);
    if (Number.isNaN(month) || Number.isNaN(targetValue)) continue;

    const areaVal = mapping.area ? r[mapping.area] : null;
    const repVal = mapping.rep ? r[mapping.rep] : null;
    const itemVal = mapping.item ? r[mapping.item] : null;

    rows.push({
      area: areaVal != null ? String(areaVal) : null,
      rep: repVal != null ? String(repVal) : null,
      item: itemVal != null ? String(itemVal) : null,
      month,
      targetValue,
    });
  }

  if (rows.length === 0) {
    throw new Error("No usable rows found after applying the target column mapping.");
  }

  return rows;
}

export function applyColumnMapping(sheet: RawSheet, mapping: ColumnMapping): ParsedSalesRow[] {
  const rows: ParsedSalesRow[] = [];

  for (const r of sheet.rows) {
    const areaVal = r[mapping.area];
    const itemVal = r[mapping.item];
    const valueVal = r[mapping.value];
    const monthVal = r[mapping.month];
    if (areaVal == null || itemVal == null || valueVal == null || monthVal == null) continue;

    const salesValue = Number(valueVal);
    const month = Math.trunc(Number(monthVal));
    if (Number.isNaN(salesValue) || Number.isNaN(month)) continue;

    const item = String(itemVal);
    const qtyRaw = mapping.qty ? r[mapping.qty] : null;
    const repRaw = mapping.rep ? r[mapping.rep] : null;
    const clusterRaw = mapping.cluster ? r[mapping.cluster] : null;

    rows.push({
      area: String(areaVal),
      item,
      family: item,
      salesQty: qtyRaw != null && !Number.isNaN(Number(qtyRaw)) ? Number(qtyRaw) : null,
      salesValue,
      month,
      rep: repRaw != null ? String(repRaw) : null,
      cluster: clusterRaw != null ? String(clusterRaw) : null,
    });
  }

  if (rows.length === 0) {
    throw new Error("No usable rows found after applying the column mapping.");
  }

  return rows;
}
