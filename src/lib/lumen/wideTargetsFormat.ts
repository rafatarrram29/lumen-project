// A Targets file usually has one plain header row (Item, Area, Rep, Month,
// FCT Val, ...) — that's the "long" format applyTargetMapping already
// handles. Some exports instead lay every month out side by side, with a
// two-row header: one row naming the month (or a computed "Year Total")
// above each block of columns, and the row below repeating the same metric
// names (Sales Qty, FCT Qty, Sales Val, FCT Val, Ach %) once per block. This
// module recognizes that "wide" shape and unpivots it into one row per
// (Item x Month) — ordinary long-format rows — so the existing
// guessTargetMapping/applyTargetMapping pipeline can read it unchanged, and
// a metric name that repeats once per month is never ambiguous: after
// unpivoting it appears exactly once per row.
import { parseNumeric, type RawSheet } from "./columnMapping";

const MAX_HEADER_SCAN_ROWS = 10;
const MAX_MONTH = 12;

type Grid = unknown[][];

const MONTH_NAMES: string[][] = [
  ["jan", "january"],
  ["feb", "february"],
  ["mar", "march"],
  ["apr", "april"],
  ["may"],
  ["jun", "june"],
  ["jul", "july"],
  ["aug", "august"],
  ["sep", "sept", "september"],
  ["oct", "october"],
  ["nov", "november"],
  ["dec", "december"],
];

/** A header-group label like "1", "6", "Jan" or "January" -> a 1-12 month number, or null if it isn't one. */
export function parseMonthGroupLabel(label: unknown): number | null {
  if (label == null) return null;
  const text = String(label).trim();
  if (text === "") return null;

  const lower = text.toLowerCase();
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (MONTH_NAMES[i].includes(lower)) return i + 1;
  }

  const n = parseNumeric(text);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < 1 || n > MAX_MONTH) return null;
  return n;
}

/**
 * A group-header label marking a computed grand-total column block ("2026
 * Total", "Year Total", plain "Total") rather than a real month. Substring,
 * not exact — these labels always pair a year or word with "Total".
 */
export function isTotalsGroupLabel(label: unknown): boolean {
  if (label == null) return false;
  return String(label).trim().toLowerCase().includes("total");
}

/**
 * A data row's own label marking a computed grand-total ROW ("Grand
 * Total"), to be dropped rather than stored as a fake item. Exact match
 * only, so a real item whose name happens to contain "total" is never
 * mistaken for one.
 */
export function isTotalsRowLabel(label: unknown): boolean {
  if (label == null) return false;
  const normalized = String(label).trim().toLowerCase();
  return normalized === "grand total" || normalized === "total";
}

type Segment = { colIndices: number[]; label: string | null };

/**
 * Splits one header row into column runs. A run starts at every cell that
 * carries a new, different label; a blank cell continues the run started by
 * the last real label before it (a merged cell, or a manually blank
 * continuation column). Columns before any real label has ever appeared
 * carry no label at all — those are never merged into one run together
 * (label === null would otherwise look like a single shared "blank" value):
 * each such column is its own single-width segment, because its real name
 * lives in the row below instead (e.g. "Item" and "Team" both sit under a
 * blank cell in the month-group row, but they are two distinct columns).
 */
function segmentHeaderRow(row: unknown[], width: number): Segment[] {
  const segments: Segment[] = [];
  let lastLabel: string | null = null;
  let anchored = false;

  for (let c = 0; c < width; c++) {
    const cell = row[c];
    const text = cell != null && String(cell).trim() !== "" ? String(cell).trim() : null;

    let startsNewSegment: boolean;
    let effectiveLabel: string | null;
    if (text != null) {
      startsNewSegment = !anchored || text !== lastLabel;
      lastLabel = text;
      anchored = true;
      effectiveLabel = text;
    } else if (anchored) {
      startsNewSegment = false;
      effectiveLabel = lastLabel;
    } else {
      startsNewSegment = true;
      effectiveLabel = null;
    }

    if (startsNewSegment) {
      segments.push({ colIndices: [c], label: effectiveLabel });
    } else {
      segments[segments.length - 1].colIndices.push(c);
    }
  }

  return segments;
}

function uniqueHeaderName(base: string, existing: string[]): string {
  const taken = new Set(existing.map((h) => h.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has(`${base} (${n})`.toLowerCase())) n++;
  return `${base} (${n})`;
}

type PassthroughCol = { colIndex: number; header: string };
type MonthGroup = { month: number; colIndices: number[] };

function buildUnpivotedSheet(
  rawGrid: Grid,
  displayGrid: Grid,
  firstDataRow: number,
  passthroughCols: PassthroughCol[],
  monthGroups: MonthGroup[],
  metricNames: string[],
): RawSheet | null {
  const monthHeader = uniqueHeaderName("Month", [...passthroughCols.map((p) => p.header), ...metricNames]);
  const headers = [...passthroughCols.map((p) => p.header), monthHeader, ...metricNames];

  const rows: Record<string, unknown>[] = [];
  const displayRows: Record<string, unknown>[] = [];

  for (let r = firstDataRow; r < rawGrid.length; r++) {
    const rawRow = rawGrid[r] ?? [];
    const displayRow = displayGrid[r] ?? [];
    if (rawRow.every((c) => c == null) && displayRow.every((c) => c == null)) continue;

    const isGrandTotalRow = passthroughCols.some(({ colIndex }) =>
      isTotalsRowLabel(displayRow[colIndex] ?? rawRow[colIndex]),
    );
    if (isGrandTotalRow) continue;

    for (const group of monthGroups) {
      const rawOut: Record<string, unknown> = {};
      const displayOut: Record<string, unknown> = {};

      for (const { colIndex, header } of passthroughCols) {
        rawOut[header] = rawRow[colIndex] ?? null;
        displayOut[header] = displayRow[colIndex] ?? null;
      }

      rawOut[monthHeader] = group.month;
      displayOut[monthHeader] = String(group.month);

      group.colIndices.forEach((colIndex, i) => {
        const header = metricNames[i];
        rawOut[header] = rawRow[colIndex] ?? null;
        displayOut[header] = displayRow[colIndex] ?? null;
      });

      rows.push(rawOut);
      displayRows.push(displayOut);
    }
  }

  if (rows.length === 0) return null;
  return { headers, rows, displayRows };
}

function tryHeaderPair(rawGrid: Grid, displayGrid: Grid, groupRowIdx: number, metricRowIdx: number, width: number): RawSheet | null {
  // Text is read from the display grid: a group cell is either a number
  // (unaffected by raw vs. display) or a label like "2026 Total" (always
  // text either way), and the metric row is always names.
  const groupRow = displayGrid[groupRowIdx] ?? [];
  const metricRow = displayGrid[metricRowIdx] ?? [];
  if (groupRow.every((c) => c == null)) return null;

  const segments = segmentHeaderRow(groupRow, width);

  const passthroughCols: PassthroughCol[] = [];
  const monthGroups: MonthGroup[] = [];

  for (const seg of segments) {
    if (seg.label == null) {
      const colIndex = seg.colIndices[0];
      const headerText = metricRow[colIndex];
      if (headerText != null && String(headerText).trim() !== "") {
        passthroughCols.push({ colIndex, header: String(headerText).trim() });
      }
      continue;
    }

    if (isTotalsGroupLabel(seg.label)) {
      // A computed grand-total column block: never unpivoted into a row.
      continue;
    }

    const month = parseMonthGroupLabel(seg.label);
    // An anchored label that is neither a recognizable month nor a total
    // marker means this row pair isn't a wide-months header at all.
    if (month == null) return null;
    monthGroups.push({ month, colIndices: seg.colIndices });
  }

  // One column-group carrying a month-like label could just as easily be an
  // ordinary long-format file with a stray label row above it; only two or
  // more real month groups make this unambiguously a wide layout.
  if (monthGroups.length < 2) return null;

  const metricNames = monthGroups[0].colIndices.map((c) => String(metricRow[c] ?? "").trim());
  if (metricNames.some((n) => n === "")) return null;

  for (const group of monthGroups) {
    if (group.colIndices.length !== metricNames.length) return null;
    const matches = group.colIndices.every(
      (c, i) => String(metricRow[c] ?? "").trim().toLowerCase() === metricNames[i].toLowerCase(),
    );
    if (!matches) return null;
  }

  return buildUnpivotedSheet(rawGrid, displayGrid, metricRowIdx + 1, passthroughCols, monthGroups, metricNames);
}

/**
 * Looks for a two-row wide-months header (a month/total label row directly
 * above a repeating metric-name row) in the first few rows of the sheet,
 * and if found, unpivots the whole sheet into a synthetic long-format
 * RawSheet (one row per Item x Month, a "Total" column-group and any
 * "Grand Total" row excluded). Returns null when the file doesn't look like
 * this shape, so the caller can fall back to normal single-header-row
 * parsing.
 */
export function detectWideTargetsLayout(rawGrid: Grid, displayGrid: Grid): RawSheet | null {
  const width = Math.max(0, ...rawGrid.map((r) => r.length), ...displayGrid.map((r) => r.length));
  if (width === 0) return null;

  const scanLimit = Math.min(MAX_HEADER_SCAN_ROWS, Math.max(0, rawGrid.length - 1));
  for (let g = 0; g < scanLimit; g++) {
    const result = tryHeaderPair(rawGrid, displayGrid, g, g + 1, width);
    if (result) return result;
  }
  return null;
}
