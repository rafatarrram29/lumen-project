// Generic sales-file ingestion: no fixed column names or file layout is
// assumed. Reading a file is two steps — find its header row and hand back
// the raw column names (readWorkbookSheet), then turn those raw rows into
// normalized records once the caller supplies a mapping from this
// dataset's own column names to the engine's fields (applyColumnMapping).
import * as XLSX from "xlsx";

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

export type Dataset = {
  id: string;
  name: string;
  columnMapping: ColumnMapping;
  createdAt: string;
};

const MAX_HEADER_SCAN_ROWS = 10;

// Real exports vary: some have headers on row 1, some have a title row
// above them. Rather than assume either shape, scan the first few rows for
// the first one that looks like a header row (multiple non-empty text
// cells) and treat that as the header.
export async function readWorkbookSheet(file: File): Promise<RawSheet> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  });

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(MAX_HEADER_SCAN_ROWS, grid.length); i++) {
    const row = grid[i] ?? [];
    const nonEmptyStringCells = row.filter(
      (c) => typeof c === "string" && c.trim() !== "",
    ).length;
    if (nonEmptyStringCells >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: headerRowIndex,
    defval: null,
  });

  if (raw.length === 0) {
    throw new Error("Couldn't find any data rows in that file.");
  }

  return { headers: Object.keys(raw[0]), rows: raw };
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
