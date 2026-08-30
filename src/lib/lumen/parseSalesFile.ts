// Parses a monthly sales export (.xls/.xlsx), same expected shape as the
// Python prototype's ingest.py: header row at row index 1 (0-based),
// columns Area, Item, Sales Qty, Sales Value, Month.
import * as XLSX from "xlsx";
import { toFamily } from "./engine";

export type ParsedSalesRow = {
  area: string;
  item: string;
  family: string;
  salesQty: number | null;
  salesValue: number;
  month: number;
};

const REQUIRED_COLUMNS = ["Area", "Item", "Sales Value", "Month"];

export async function parseSalesFile(file: File): Promise<ParsedSalesRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: 1,
    defval: null,
  });

  if (raw.length === 0) {
    throw new Error("Couldn't find any rows in that file.");
  }

  const columns = new Set(Object.keys(raw[0]));
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.has(c));
  if (missing.length > 0) {
    throw new Error(`Source file is missing expected columns: ${missing.join(", ")}`);
  }

  const rows: ParsedSalesRow[] = [];
  for (const r of raw) {
    if (r["Area"] == null || r["Item"] == null || r["Sales Value"] == null || r["Month"] == null) {
      continue;
    }
    const item = String(r["Item"]);
    const salesValue = Number(r["Sales Value"]);
    const month = Math.trunc(Number(r["Month"]));
    if (Number.isNaN(salesValue) || Number.isNaN(month)) continue;

    rows.push({
      area: String(r["Area"]),
      item,
      family: toFamily(item),
      salesQty: r["Sales Qty"] != null && !Number.isNaN(Number(r["Sales Qty"]))
        ? Number(r["Sales Qty"])
        : null,
      salesValue,
      month,
    });
  }

  if (rows.length === 0) {
    throw new Error("No usable rows found after validating required columns.");
  }

  return rows;
}
