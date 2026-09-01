// The `xlsx` (SheetJS) library is large enough that it's worth keeping
// isolated to this one file, imported only via a dynamic import() at the
// point of use (a user actually picking a file to upload) rather than
// statically — columnMapping.ts's other exports (types, applyColumnMapping,
// guessMapping, etc.) are needed just to render the dashboard, and a static
// import here would have pulled xlsx into that same bundle on every page
// load whether or not anyone ever uploads a file.
import * as XLSX from "xlsx";
import type { RawSheet } from "./columnMapping";

const MAX_HEADER_SCAN_ROWS = 10;

// Real exports vary: some have headers on row 1, some have a title row
// above them. Rather than assume either shape, scan the first few rows for
// the first one that looks like a header row (multiple non-empty text
// cells) and treat that as the header.
// xlsx doesn't reliably reject a file that isn't actually a spreadsheet —
// fed a PDF, it can come back with a "sheet" of a few garbage header cells
// instead of throwing, which used to surface as an empty, all-unmapped
// column-mapping screen with no explanation. A PDF is common enough to
// misdirect here (someone reaching for the Sales/linked-file uploader with
// a file meant for the IMS tab's PDF import) that it's worth naming
// explicitly instead of just "not a valid file".
function checkIsSpreadsheet(buffer: ArrayBuffer, fileName: string) {
  const head = new Uint8Array(buffer.slice(0, 5));
  const headStr = String.fromCharCode(...head);
  if (headStr === "%PDF-") {
    throw new Error(
      `"${fileName}" is a PDF, not a spreadsheet. This uploader only reads Excel/CSV/ODS files — for a PDF, use "+ Upload IMS file" on the Market Insights tab instead.`,
    );
  }
}

export async function readWorkbookSheet(file: File): Promise<RawSheet> {
  const buffer = await file.arrayBuffer();
  checkIsSpreadsheet(buffer, file.name);
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
