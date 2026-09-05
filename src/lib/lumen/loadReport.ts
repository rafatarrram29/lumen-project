// One place that turns (dataset, year) into the report the dashboard shows.
//
// This used to exist twice: once in the /lumen server component for the
// first paint, and once in /api/lumen/analyze for every dataset or year
// switch afterwards. Two copies of a fetch, a row mapping and a
// buildReport() call — and they had already drifted. Only the API version
// selected the is_edited/edited_at/edited_by columns and derived
// `editedCells` from them, so on a fresh page load none of the manually
// corrected figures were marked as corrected; they only lit up once the
// user happened to switch dataset or press Analyze, which made the marks
// look intermittent rather than absent.
//
// Both callers now go through here, so there is no second copy left to
// drift from.

import { buildReport, type Report, type SalesRecord, type TargetRecord } from "./engine";
import { fetchAllRows } from "./fetchAllRows";

/**
 * A figure that was changed by hand after upload. `key` is a JSON-encoded
 * [area, family, month] triple so the client can look a cell up without
 * ever seeing raw row ids.
 */
export type EditedCell = { key: string; editedBy: string | null; editedAt: string };

export type ReportPayload = Report & { editedCells: EditedCell[] };

type SalesRow = {
  area: string;
  family: string;
  sales_value: number | string;
  sales_qty: number | string | null;
  month: number | string;
  line: string | null;
  rep: string | null;
  is_edited?: boolean | null;
  edited_at?: string | null;
  edited_by?: string | null;
};

type TargetRow = {
  area: string | null;
  rep: string | null;
  item: string | null;
  month: number | string;
  target_value: number | string;
};

// `import type` only — erased at build time, so pulling in the server
// client's type here never drags next/headers into a client bundle.
type SupabaseServerClient = Awaited<ReturnType<typeof import("../supabase/server").createClient>>;

/**
 * The most recent year this dataset actually has sales for.
 *
 * The dashboard used to open on the calendar year, which meant that on 1
 * January a dashboard full of last year's data greeted its owner with "No
 * data found for year 2026" — the data was fine, the app was just looking
 * at a year nobody had uploaded yet. Falls back to the calendar year only
 * when there is nothing at all to go on (an empty dataset), which is the
 * right year to start uploading into.
 */
export async function latestYearWithData(
  supabase: SupabaseServerClient,
  datasetId: string,
): Promise<number> {
  const { data } = await supabase
    .from("lumen_sales_records")
    .select("year")
    .eq("dataset_id", datasetId)
    .order("year", { ascending: false })
    .limit(1);

  const year = Number(data?.[0]?.year);
  return Number.isInteger(year) ? year : new Date().getFullYear();
}

export async function loadReport(
  supabase: SupabaseServerClient,
  datasetId: string,
  year: number,
): Promise<{ payload: ReportPayload | null; error: string | null }> {
  // Neither query depends on the other's result — fetching them
  // concurrently instead of one after another roughly halves the wait.
  const [sales, targetRows] = await Promise.all([
    fetchAllRows<SalesRow>(
      () =>
        supabase
          .from("lumen_sales_records")
          .select("area, family, sales_value, sales_qty, month, line, rep, is_edited, edited_at, edited_by")
          .eq("year", year)
          .eq("dataset_id", datasetId),
    ),
    fetchAllRows<TargetRow>(
      () =>
        supabase
          .from("lumen_targets")
          .select("area, rep, item, month, target_value")
          .eq("year", year)
          .eq("dataset_id", datasetId),
    ),
  ]);

  if (sales.error) return { payload: null, error: sales.error };

  const records: SalesRecord[] = sales.data.map((r) => ({
    area: r.area,
    family: r.family,
    salesValue: Number(r.sales_value),
    salesQty: r.sales_qty !== null && r.sales_qty !== undefined ? Number(r.sales_qty) : null,
    month: Number(r.month),
    line: r.line,
    rep: r.rep,
  }));

  const targets: TargetRecord[] = targetRows.data.map((t) => ({
    area: t.area,
    rep: t.rep,
    item: t.item,
    month: Number(t.month),
    targetValue: Number(t.target_value),
  }));

  const report = buildReport(records, year, targets);

  return { payload: { ...report, editedCells: collectEditedCells(sales.data) }, error: null };
}

/**
 * One entry per edited (area, item, month) cell, carrying the most recent
 * edit to it — a cell can have several rows behind it, and the latest edit
 * is the one worth attributing.
 */
export function collectEditedCells(rows: SalesRow[]): EditedCell[] {
  const byCell = new Map<string, { editedBy: string | null; editedAt: string }>();

  for (const r of rows) {
    if (!r.is_edited) continue;
    const key = JSON.stringify([r.area, r.family, Number(r.month)]);
    const editedAt = r.edited_at ?? new Date(0).toISOString();
    const existing = byCell.get(key);
    if (!existing || editedAt > existing.editedAt) {
      byCell.set(key, { editedBy: r.edited_by ?? null, editedAt });
    }
  }

  // Sorted so the payload is byte-identical for identical data, for the
  // same reason the engine's findings are — see engine.ts.
  return Array.from(byCell.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, info]) => ({ key, ...info }));
}
