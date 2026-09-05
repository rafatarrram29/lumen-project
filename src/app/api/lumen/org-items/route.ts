import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";
import { readSalesRows } from "@/lib/lumen/loadReport";

// Per-item monthly totals, restricted to a set of areas.
//
// This is what a District Manager card shows when you open it: the item
// breakdown for that manager's areas specifically, not the whole dataset's.
//
// It is its own endpoint rather than another field on the report because
// the report would then have to carry area x item x month for every
// combination — which is precisely the payload P4 removed. A manager card
// is opened deliberately, one at a time, so its data is fetched then.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  // POST, not GET: area names are free text from the uploaded file and can
  // contain commas, which a comma-joined query parameter would split.
  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;
  const areas = Array.isArray(body?.areas)
    ? body.areas.filter((a: unknown): a is string => typeof a === "string")
    : [];

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!datasetId) {
    return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  }
  if (areas.length === 0) {
    return NextResponse.json({ items: {}, hasQuantity: false, months: [] });
  }

  const { data, error } = await readSalesRows(supabase, datasetId, year);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const wanted = new Set(areas);
  const byItem = new Map<string, Map<number, { value: number; qty: number }>>();
  const months = new Set<number>();
  let hasQuantity = false;

  for (const row of data) {
    if (!wanted.has(row.area)) continue;
    const month = Number(row.month);
    months.add(month);
    if (row.sales_qty !== null && row.sales_qty !== undefined) hasQuantity = true;

    const series = byItem.get(row.family) ?? new Map<number, { value: number; qty: number }>();
    const point = series.get(month) ?? { value: 0, qty: 0 };
    series.set(month, {
      value: point.value + Number(row.sales_value),
      qty: point.qty + (row.sales_qty !== null && row.sales_qty !== undefined ? Number(row.sales_qty) : 0),
    });
    byItem.set(row.family, series);
  }

  const orderedMonths = [...months].sort((a, b) => a - b);
  const items: Record<string, { month: number; value: number; qty: number }[]> = {};
  for (const [item, series] of byItem) {
    items[item] = orderedMonths
      .filter((m) => series.has(m))
      .map((m) => ({ month: m, value: Math.round(series.get(m)!.value), qty: Math.round(series.get(m)!.qty) }));
  }

  return NextResponse.json({ items, hasQuantity, months: orderedMonths });
}
