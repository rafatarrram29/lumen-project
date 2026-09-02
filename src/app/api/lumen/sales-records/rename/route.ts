import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Renames an item or area name across a dataset — a correction for a name
// that was mis-typed, mis-parsed, or otherwise wrong, as opposed to
// sales-records/cell's per-cell VALUE edit. Because "item"/"area" is the
// identity every level of the report groups and matches by (area totals,
// item breakdowns, targets vs actual, rep assignment history, linked
// files), a rename has to reach every table that stores that same string,
// not just lumen_sales_records — otherwise Targets or Rep history would
// keep pointing at a name that no longer exists anywhere else, silently
// breaking their matching.
//
// lumen_targets and lumen_rep_assignments only got their own UPDATE
// policies in lumen_rename_cascade_migration.sql — until that's run,
// Postgres RLS quietly matches zero rows for those two updates (not an
// error) rather than blocking the whole rename, so the rename still fully
// works for the main Sales table and linked files immediately; Targets and
// Rep history just catch up once the migration is run.
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
  const field = body?.field === "area" || body?.field === "item" ? body.field : null;
  const oldValue = typeof body?.oldValue === "string" ? body.oldValue.trim() : null;
  const newValue = typeof body?.newValue === "string" ? body.newValue.trim() : null;
  const isUndo = body?.isUndo === true;

  if (!datasetId) return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  if (!field) return NextResponse.json({ error: "field must be \"area\" or \"item\"" }, { status: 400 });
  if (!oldValue) return NextResponse.json({ error: "Missing oldValue" }, { status: 400 });
  if (!newValue) return NextResponse.json({ error: "New name can't be empty" }, { status: 400 });
  if (oldValue === newValue) return NextResponse.json({ error: "New name is the same as the old one" }, { status: 400 });

  const editedAt = new Date().toISOString();
  const editedBy = user.email ?? user.id;

  // Branched explicitly (rather than building an update object keyed by a
  // dynamic `field` string) so every .update()/.eq() call sees a concrete,
  // literal column name — Supabase's generated query types don't resolve
  // well through a dynamic column name here.
  let salesCount = 0;
  let salesError: { message: string } | null = null;
  if (field === "item") {
    const { count, error } = await supabase
      .from("lumen_sales_records")
      .update({ item: newValue, family: newValue, is_edited: true, edited_at: editedAt, edited_by: editedBy }, { count: "exact" })
      .eq("dataset_id", datasetId)
      .eq("item", oldValue);
    salesCount = count ?? 0;
    salesError = error;
  } else {
    const { count, error } = await supabase
      .from("lumen_sales_records")
      .update({ area: newValue, is_edited: true, edited_at: editedAt, edited_by: editedBy }, { count: "exact" })
      .eq("dataset_id", datasetId)
      .eq("area", oldValue);
    salesCount = count ?? 0;
    salesError = error;
  }

  if (salesError) {
    return NextResponse.json({ error: salesError.message }, { status: 500 });
  }
  if (!salesCount) {
    return NextResponse.json(
      { error: `No "${oldValue}" rows found in this dataset, or you don't have permission to edit them` },
      { status: 404 },
    );
  }

  // Best-effort cascade into every other table that stores the same name —
  // never fails the whole rename if one of these tables' rows don't (yet)
  // have an UPDATE policy or simply has no matching rows.
  let targetsCount = 0;
  if (field === "item") {
    const { count } = await supabase
      .from("lumen_targets")
      .update({ item: newValue }, { count: "exact" })
      .eq("dataset_id", datasetId)
      .eq("item", oldValue);
    targetsCount = count ?? 0;
  } else {
    const { count } = await supabase
      .from("lumen_targets")
      .update({ area: newValue }, { count: "exact" })
      .eq("dataset_id", datasetId)
      .eq("area", oldValue);
    targetsCount = count ?? 0;
  }

  let repAssignmentsCount = 0;
  if (field === "area") {
    const { count } = await supabase
      .from("lumen_rep_assignments")
      .update({ area: newValue }, { count: "exact" })
      .eq("dataset_id", datasetId)
      .eq("area", oldValue);
    repAssignmentsCount = count ?? 0;
  }

  let linkedCount = 0;
  if (field === "area") {
    const { count } = await supabase
      .from("lumen_dataset_records")
      .update({ area: newValue, is_edited: true, edited_at: editedAt, edited_by: editedBy }, { count: "exact" })
      .eq("dataset_id", datasetId)
      .eq("area", oldValue);
    linkedCount = count ?? 0;
  }

  const totalCount = salesCount + targetsCount + repAssignmentsCount + linkedCount;

  const { error: logError } = await supabase.from("lumen_data_edits").insert({
    dataset_id: datasetId,
    target_label: field === "item" ? `Item name (${totalCount} row(s))` : `Area name (${totalCount} row(s))`,
    old_value: oldValue,
    new_value: newValue,
    edited_by: editedBy,
    is_undo: isUndo,
  });
  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  return NextResponse.json({ updated: true, oldValue, newValue, count: totalCount });
}
