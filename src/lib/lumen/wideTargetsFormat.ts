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
//
// Real exports lean on genuine Excel cell merges for this layout, and two
// things about them only become visible once you read the merge list
// itself rather than guessing from blank cells: a metric name can be
// merged across a *different* width in one month block than in the others
// (a leftover from however the sheet was built), and a "Year Total" label
// is often merged *vertically* — spanning the year row and the month-number
// row — so its own row has no month-number cell to read at all. Both are
// handled by resolving every header cell through the sheet's own `!merges`
// first, rather than inferring merge boundaries from null runs.
import { parseNumeric, type RawSheet } from "./columnMapping";

const MAX_HEADER_SCAN_ROWS = 10;
const MAX_MONTH = 12;

type Grid = unknown[][];
export type MergeRange = { s: { r: number; c: number }; e: { r: number; c: number } };

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

/**
 * Maps every non-anchor cell covered by a merge to its anchor's {r, c} —
 * the cell that actually carries the value the whole merged block shares.
 */
function buildMergeMap(merges: MergeRange[]): Map<string, { r: number; c: number }> {
  const map = new Map<string, { r: number; c: number }>();
  for (const m of merges) {
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) continue;
        map.set(`${r},${c}`, { r: m.s.r, c: m.s.c });
      }
    }
  }
  return map;
}

/**
 * A cell's logical value: its own value if it has one, otherwise (when it's
 * blank) the anchor value of whatever merge covers it — which may sit in a
 * different row entirely, as a "Year Total" label merged down from the row
 * above the month numbers does.
 */
function resolveCell(grid: Grid, mergeMap: Map<string, { r: number; c: number }>, r: number, c: number): unknown {
  const direct = grid[r]?.[c];
  if (direct != null && String(direct).trim() !== "") return direct;
  const anchor = mergeMap.get(`${r},${c}`);
  if (anchor) return grid[anchor.r]?.[anchor.c] ?? null;
  return direct ?? null;
}

function resolveRow(grid: Grid, mergeMap: Map<string, { r: number; c: number }>, r: number, width: number): unknown[] {
  const row: unknown[] = [];
  for (let c = 0; c < width; c++) row.push(resolveCell(grid, mergeMap, r, c));
  return row;
}

type Segment = { colIndices: number[]; label: string | null };

/**
 * Splits one already-merge-resolved header row into column runs. A run
 * starts at every cell that carries a new, different label; a still-blank
 * cell (nothing of its own, and no merge to resolve it) continues the run
 * started by the last real label before it — the fallback for a label
 * manually retyped in every column rather than a true merge, or a stray
 * gap. Columns before any real label has ever appeared carry no label at
 * all — those are never merged into one run together (label === null would
 * otherwise look like a single shared "blank" value): each such column is
 * its own single-width segment, because its real name lives in the row
 * below instead (e.g. "Item" and "Team" both sit under a blank cell in the
 * month-group row, but they are two distinct columns).
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

/**
 * The metric columns (e.g. Sales Qty, FCT Qty, Sales Val, FCT Val, Ach %)
 * within one month block's column range, reading the merge-resolved metric
 * row so a metric merged wider in this particular block than in others
 * (a real file's Sales Qty/FCT Qty columns, merged two-wide in the first
 * month but not the rest) still collapses to one logical column, keyed by
 * its anchor — the only column that ever holds real data for it.
 */
function segmentMetricRange(resolvedMetricRow: unknown[], rangeStart: number, rangeEnd: number): { colIndex: number; header: string }[] {
  const slice = resolvedMetricRow.slice(rangeStart, rangeEnd);
  const segments = segmentHeaderRow(slice, slice.length);
  const cols: { colIndex: number; header: string }[] = [];
  for (const seg of segments) {
    if (seg.label == null) continue;
    cols.push({ colIndex: seg.colIndices[0] + rangeStart, header: seg.label });
  }
  return cols;
}

function uniqueHeaderName(base: string, existing: string[]): string {
  const taken = new Set(existing.map((h) => h.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has(`${base} (${n})`.toLowerCase())) n++;
  return `${base} (${n})`;
}

type PassthroughCol = { colIndex: number; header: string };
type MetricCol = { colIndex: number; header: string };
type MonthGroup = { month: number; metricCols: MetricCol[] };

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

      group.metricCols.forEach(({ colIndex }, i) => {
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

function tryHeaderPair(
  rawGrid: Grid,
  displayGrid: Grid,
  mergeMap: Map<string, { r: number; c: number }>,
  groupRowIdx: number,
  metricRowIdx: number,
  width: number,
): RawSheet | null {
  // Text is read from the display grid: a group cell is either a number
  // (unaffected by raw vs. display) or a label like "2026 Total" (always
  // text either way), and the metric row is always names. Both are
  // resolved through the sheet's own merges first, so a label that's
  // merged in from a different row or a different width than its
  // neighbors is read the same as a plain unmerged cell.
  const groupRow = resolveRow(displayGrid, mergeMap, groupRowIdx, width);
  const metricRow = resolveRow(displayGrid, mergeMap, metricRowIdx, width);
  if (groupRow.every((c) => c == null)) return null;

  const segments = segmentHeaderRow(groupRow, width);

  const passthroughCols: PassthroughCol[] = [];
  const monthRanges: { month: number; start: number; end: number }[] = [];

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
    monthRanges.push({ month, start: seg.colIndices[0], end: seg.colIndices[seg.colIndices.length - 1] + 1 });
  }

  // One column-group carrying a month-like label could just as easily be an
  // ordinary long-format file with a stray label row above it; only two or
  // more real month groups make this unambiguously a wide layout.
  if (monthRanges.length < 2) return null;

  const monthGroups: MonthGroup[] = monthRanges.map(({ month, start, end }) => ({
    month,
    metricCols: segmentMetricRange(metricRow, start, end),
  }));

  const metricNames = monthGroups[0].metricCols.map((c) => c.header);
  if (metricNames.length === 0) return null;

  for (const group of monthGroups) {
    if (group.metricCols.length !== metricNames.length) return null;
    const matches = group.metricCols.every((c, i) => c.header.toLowerCase() === metricNames[i].toLowerCase());
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
 * parsing. `merges` should be the source worksheet's own `!merges` list —
 * passing none still works for a manually-retyped-label file, but a real
 * merged header (a wider metric block in one month, or a total label
 * merged in from another row) needs it to be read correctly.
 */
export function detectWideTargetsLayout(rawGrid: Grid, displayGrid: Grid, merges: MergeRange[] = []): RawSheet | null {
  const width = Math.max(0, ...rawGrid.map((r) => r.length), ...displayGrid.map((r) => r.length));
  if (width === 0) return null;

  const mergeMap = buildMergeMap(merges);
  const scanLimit = Math.min(MAX_HEADER_SCAN_ROWS, Math.max(0, rawGrid.length - 1));
  for (let g = 0; g < scanLimit; g++) {
    const result = tryHeaderPair(rawGrid, displayGrid, mergeMap, g, g + 1, width);
    if (result) return result;
  }
  return null;
}
