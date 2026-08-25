import Papa from "papaparse";
import * as XLSX from "@e965/xlsx";

export type ParsedFile = {
  columns: string[];
  rows: Record<string, unknown>[];
};

const MAX_ROWS = 5000;
const MAX_COLUMNS = 100;

export function parseFile(file: File): Promise<ParsedFile> {
  const isExcel = /\.xlsx?$/i.test(file.name);
  if (isExcel) return parseExcel(file);
  return parseCsv(file);
}

function parseCsv(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (result) => {
        const columns = (result.meta.fields ?? []).slice(0, MAX_COLUMNS);
        const rows = result.data.slice(0, MAX_ROWS);
        resolve({ columns, rows });
      },
      error: (err: Error) => reject(err),
    });
  });
}

async function parseExcel(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { columns: [], rows: [] };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  }).slice(0, MAX_ROWS);
  const columns = rows.length > 0 ? Object.keys(rows[0]).slice(0, MAX_COLUMNS) : [];

  return { columns, rows };
}
