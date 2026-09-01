import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Inline-edits a single "area x item x month" sales figure. There is
// normally exactly one raw lumen_sales_records row behind that figure, but
// if more than one contributed to the same total (e.g. split across reps),
// the new total is redistributed across all of them in proportion to their
// current share, so nothing downstream that reads per-row rep/cluster data
// silently loses it. Every level that depends on these rows (area totals,
// cluster averages, targets, rep leaderboard, findings) is derived fresh
// from lumen_sales_records on every /api/lumen/analyze call, so nothing
// else needs to be told about this edit — the next report fetch already
// reflects it.
export async function PATCH(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;
  const year = Number(body?.year);
  const month = Number(body?.month);
  const area = typeof body?.area === "string" ? body.area : null;
  const family = typeof body?.family === "string" ? body.family : null;
  const newValue = Number(body?.newValue);

  if (!datasetId) return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  if (!Number.isInteger(year)) return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  if (!Number.isInteger(month)) return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  if (!area) return NextResponse.json({ error: "Missing area" }, { status: 400 });
  if (!family) return NextResponse.json({ error: "Missing family" }, { status: 400 });
  if (!Number.isFinite(newValue)) return NextResponse.json({ error: "Invalid newValue" }, { status: 400 });

  const { data: rows, error: selectError } = await supabase
    .from("lumen_sales_records")
    .select("id, sales_value")
    .eq("dataset_id", datasetId)
    .eq("year", year)
    .eq("month", month)
    .eq("area", area)
    .eq("family", family);

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { error: "No matching rows found, or you don't have permission to edit them" },
      { status: 404 },
    );
  }

  const oldValues = rows.map((r) => Number(r.sales_value));
  const oldTotal = oldValues.reduce((sum, v) => sum + v, 0);

  // Redistribute the new total across every underlying row, preserving
  // each row's relative share (or splitting evenly if the old total was
  // zero) — the last row absorbs any rounding remainder so the rows sum to
  // exactly newValue.
  const newValues: number[] = [];
  if (rows.length === 1) {
    newValues.push(newValue);
  } else if (oldTotal !== 0) {
    let runningSum = 0;
    for (let i = 0; i < rows.length - 1; i++) {
      const share = Math.round((oldValues[i] / oldTotal) * newValue * 100) / 100;
      newValues.push(share);
      runningSum += share;
    }
    newValues.push(Math.round((newValue - runningSum) * 100) / 100);
  } else {
    const evenShare = Math.round((newValue / rows.length) * 100) / 100;
    let runningSum = 0;
    for (let i = 0; i < rows.length - 1; i++) {
      newValues.push(evenShare);
      runningSum += evenShare;
    }
    newValues.push(Math.round((newValue - runningSum) * 100) / 100);
  }

  const editedAt = new Date().toISOString();
  const editedBy = user.email ?? user.id;

  for (let i = 0; i < rows.length; i++) {
    const { error: updateError } = await supabase
      .from("lumen_sales_records")
      .update({ sales_value: newValues[i], is_edited: true, edited_at: editedAt, edited_by: editedBy })
      .eq("id", rows[i].id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  const { error: logError } = await supabase.from("lumen_data_edits").insert({
    dataset_id: datasetId,
    target_label: `${area} · ${family} · ${year}-${String(month).padStart(2, "0")}`,
    old_value: String(oldTotal),
    new_value: String(newValue),
    edited_by: editedBy,
  });
  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  return NextResponse.json({ updated: true, oldValue: oldTotal, newValue });
}
