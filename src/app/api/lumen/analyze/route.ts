import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildReport, type SalesRecord, type TargetRecord } from "@/lib/lumen/engine";
import { fetchAllRows } from "@/lib/lumen/fetchAllRows";

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const datasetId = searchParams.get("datasetId");

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!datasetId) {
    return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  }

  const { data, error } = await fetchAllRows((from, to) =>
    supabase
      .from("lumen_sales_records")
      .select("area, family, sales_value, sales_qty, month, cluster, rep, is_edited, edited_at, edited_by")
      .eq("year", year)
      .eq("dataset_id", datasetId)
      .range(from, to),
  );

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const records: SalesRecord[] = (data ?? []).map((r) => ({
    area: r.area as string,
    family: r.family as string,
    salesValue: Number(r.sales_value),
    salesQty: r.sales_qty !== null ? Number(r.sales_qty) : null,
    month: Number(r.month),
    cluster: r.cluster as string | null,
    rep: r.rep as string | null,
  }));

  const { data: targetData } = await fetchAllRows((from, to) =>
    supabase
      .from("lumen_targets")
      .select("area, rep, item, month, target_value")
      .eq("year", year)
      .eq("dataset_id", datasetId)
      .range(from, to),
  );

  const targets: TargetRecord[] = (targetData ?? []).map((t) => ({
    area: t.area as string | null,
    rep: t.rep as string | null,
    item: t.item as string | null,
    month: Number(t.month),
    targetValue: Number(t.target_value),
  }));

  const report = buildReport(records, year, targets);

  // JSON-encoded [area, family, month] keys for every row that was
  // manually edited, with who/when the most recent edit to that cell was —
  // lets the dashboard mark exactly the figures that came from an inline
  // edit rather than the originally uploaded file, without exposing raw
  // row ids to the client.
  const editedCellsMap = new Map<string, { editedBy: string | null; editedAt: string }>();
  for (const r of data ?? []) {
    if (!r.is_edited) continue;
    const key = JSON.stringify([r.area as string, r.family as string, r.month as number]);
    const existing = editedCellsMap.get(key);
    if (!existing || (r.edited_at && r.edited_at > existing.editedAt)) {
      editedCellsMap.set(key, {
        editedBy: r.edited_by as string | null,
        editedAt: (r.edited_at as string) ?? new Date(0).toISOString(),
      });
    }
  }
  const editedCells = Array.from(editedCellsMap.entries()).map(([key, info]) => ({ key, ...info }));

  return NextResponse.json({ ...report, editedCells });
}
