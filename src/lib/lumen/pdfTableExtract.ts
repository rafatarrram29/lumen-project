// PDF table extraction — Node-only (uses pdfjs-dist's Node/legacy build,
// no DOM or canvas needed for text extraction). Used exclusively by the
// IMS PDF-import API route (src/app/api/lumen/ims-pdf-extract/route.ts).
// Never imported by the Sales upload path or any client component —
// keeping this fully separate is what lets IMS support PDFs without
// touching Sales at all.
//
// A PDF export/deck's tables are almost never a clean, uniform grid the
// way an Excel sheet is: this same real-world test file mixes real data
// tables with narrative paragraphs, native charts, and title slides, and
// some of those land in the exact same on-page position as a real table.
// Every page is therefore treated independently (no assumption that page
// 2's layout says anything about page 3's), and a strict quality gate
// decides whether a candidate grid is confidently a real table before it's
// ever shown to the user — a low-confidence guess is worse than admitting
// "couldn't find a clean table here" and asking for manual entry, which is
// exactly the choice this module makes.

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { WorkerMessageHandler } from "pdfjs-dist/legacy/build/pdf.worker.mjs";

// In Node, pdfjs-dist runs its parser through a "fake worker" (same thread,
// no real Worker). To set that up it first checks for a
// `globalThis.pdfjsWorker.WorkerMessageHandler` global — and only if that's
// absent does it fall back to dynamically `import()`-ing a workerSrc path
// computed relative to its own module location. That fallback path doesn't
// survive being deployed as a Next.js serverless function (the file layout
// on the server isn't the same as in node_modules), which surfaced in
// production as "Setting up fake worker failed: Cannot find module
// '.../pdf.worker.mjs'". Importing the worker module ourselves with a
// normal static import — which bundlers *can* trace and ship correctly,
// unlike the dynamic path — and publishing it on that global short-circuits
// the fallback entirely, so the broken path is never taken.
(globalThis as unknown as { pdfjsWorker?: { WorkerMessageHandler: unknown } }).pdfjsWorker = {
  WorkerMessageHandler,
};

export type ExtractedTable = { headers: string[]; rows: string[][] };
export type ExtractedPage = {
  pageNumber: number;
  title: string;
  status: "ok" | "no_table" | "image";
  tables: ExtractedTable[];
};

type Cell = { x0: number; x1: number; y: number; text: string };
type Line = { y: number; cells: Cell[] };

const MIN_CELLS_FOR_TEXT_PAGE = 8;
const LINE_Y_TOLERANCE = 2.5;
const NUMERIC_RE = /^\(?-?[\d,.]+%?\)?$/;

function looksNumeric(s: string): boolean {
  return NUMERIC_RE.test(s);
}

function groupIntoLines(cells: Cell[]): Line[] {
  const sorted = [...cells].sort((a, b) => b.y - a.y); // PDF y grows upward -> top of page first
  const lines: Line[] = [];
  for (const c of sorted) {
    const line = lines.find((l) => Math.abs(l.y - c.y) < LINE_Y_TOLERANCE);
    if (line) line.cells.push(c);
    else lines.push({ y: c.y, cells: [c] });
  }
  for (const l of lines) l.cells.sort((a, b) => a.x0 - b.x0);
  return lines;
}

// Scans top-to-bottom for a header-like line (label-heavy, not numeric),
// then greedily consumes following lines whose cells fall within that
// header's column span as candidate data rows, stopping the moment a line
// has nothing in that span. Accepts the candidate as a real table only if
// enough rows share a plausible column count AND are numeric-heavy, and
// the header itself is NOT numeric-heavy (rejects chart data-point labels
// and axis values, which otherwise look exactly like a small grid).
function detectTables(lines: Line[]): ExtractedTable[] {
  const tables: ExtractedTable[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.cells.length < 2) {
      i++;
      continue;
    }
    const xBounds: [number, number] = [
      Math.min(...line.cells.map((c) => c.x0)) - 3,
      Math.max(...line.cells.map((c) => c.x1)) + 3,
    ];
    const rows: string[][] = [];
    let consumedTo = i;
    for (let j = i + 1; j < lines.length; j++) {
      const candidate = lines[j];
      const inRange = candidate.cells.filter((c) => c.x0 >= xBounds[0] - 60 && c.x0 <= xBounds[1] + 5);
      if (inRange.length === 0) break;
      rows.push(inRange.map((c) => c.text));
      consumedTo = j;
    }

    const headerCells = line.cells.map((c) => c.text);
    const colCount = headerCells.length;
    const headerNumericFrac = headerCells.filter((c) => looksNumeric(c)).length / headerCells.length;
    const consistentRows = rows.filter((r) => Math.abs(r.length - colCount) <= 2 && r.length >= 2);
    const numericHeavyRows = consistentRows.filter((r) => {
      const numericCount = r.filter((c) => looksNumeric(c)).length;
      return numericCount / r.length >= 0.4;
    });
    const passes =
      headerNumericFrac < 0.3 &&
      consistentRows.length >= 2 &&
      numericHeavyRows.length / Math.max(1, consistentRows.length) >= 0.6;

    if (passes) {
      tables.push({ headers: headerCells, rows: consistentRows });
      i = consumedTo + 1;
    } else {
      i++;
    }
  }
  return tables;
}

export async function extractTablesFromPdf(buffer: Buffer): Promise<ExtractedPage[]> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: ExtractedPage[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const cells: Cell[] = [];
    for (const item of content.items as { str: string; transform: number[]; width: number }[]) {
      const str = item.str.trim();
      if (!str) continue;
      cells.push({ x0: item.transform[4], x1: item.transform[4] + item.width, y: item.transform[5], text: str });
    }

    if (cells.length < MIN_CELLS_FOR_TEXT_PAGE) {
      pages.push({ pageNumber, title: `Page ${pageNumber}`, status: "image", tables: [] });
      continue;
    }

    const lines = groupIntoLines(cells);
    const title = lines[0]?.cells.map((c) => c.text).join(" ").slice(0, 120) || `Page ${pageNumber}`;
    const tables = detectTables(lines);

    pages.push({
      pageNumber,
      title,
      status: tables.length > 0 ? "ok" : "no_table",
      tables,
    });
  }

  return pages;
}
