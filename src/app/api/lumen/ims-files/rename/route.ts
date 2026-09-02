import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Renames an area, product, or company name across every IMS file in a
// dataset — the IMS-side counterpart of sales-records/rename. The same
// product (e.g. a molecule/brand) is typically re-uploaded month after
// month across several IMS files, so a name correction (a mis-extracted
// concentration, a mis-typed company name) needs to apply dataset-wide,
// not just to whichever one file/table it was first noticed in.
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
  const field = ["area", "product", "company"].includes(body?.field) ? (body.field as "area" | "product" | "company") : null;
  const oldValue = typeof body?.oldValue === "string" ? body.oldValue.trim() : null;
  const newValue = typeof body?.newValue === "string" ? body.newValue.trim() : null;
  const isUndo = body?.isUndo === true;

  if (!datasetId) return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  if (!field) return NextResponse.json({ error: "field must be \"area\", \"product\", or \"company\"" }, { status: 400 });
  if (!oldValue) return NextResponse.json({ error: "Missing oldValue" }, { status: 400 });
  if (!newValue) return NextResponse.json({ error: "New name can't be empty" }, { status: 400 });
  if (oldValue === newValue) return NextResponse.json({ error: "New name is the same as the old one" }, { status: 400 });

  const editedBy = user.email ?? user.id;

  // Only lumen_ims_records gained an UPDATE policy in
  // lumen_rename_cascade_migration.sql — until that's run, this matches
  // zero rows under RLS rather than erroring, so the rest of the app keeps
  // working; the rename just won't take effect on IMS data yet.
  //
  // Branched explicitly (rather than building an update object keyed by a
  // dynamic `field` string) so every .update()/.eq() call sees a concrete,
  // literal column name — Supabase's generated query types don't resolve
  // well through a dynamic column name here.
  let count = 0;
  let updateError: { message: string } | null = null;
  if (field === "area") {
    const res = await supabase
      .from("lumen_ims_records")
      .update({ area: newValue }, { count: "exact" })
      .eq("dataset_id", datasetId)
      .eq("area", oldValue);
    count = res.count ?? 0;
    updateError = res.error;
  } else if (field === "product") {
    const res = await supabase
      .from("lumen_ims_records")
      .update({ product: newValue }, { count: "exact" })
      .eq("dataset_id", datasetId)
      .eq("product", oldValue);
    count = res.count ?? 0;
    updateError = res.error;
  } else {
    const res = await supabase
      .from("lumen_ims_records")
      .update({ company: newValue }, { count: "exact" })
      .eq("dataset_id", datasetId)
      .eq("company", oldValue);
    count = res.count ?? 0;
    updateError = res.error;
  }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json(
      {
        error: `No "${oldValue}" rows found in this dataset, or the ims-records UPDATE policy from lumen_rename_cascade_migration.sql hasn't been run yet`,
      },
      { status: 404 },
    );
  }

  const fieldLabel = field === "area" ? "Area" : field === "product" ? "Product" : "Company";
  const { error: logError } = await supabase.from("lumen_data_edits").insert({
    dataset_id: datasetId,
    target_label: `IMS ${fieldLabel} name (${count} row(s))`,
    old_value: oldValue,
    new_value: newValue,
    edited_by: editedBy,
    is_undo: isUndo,
  });
  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  return NextResponse.json({ updated: true, oldValue, newValue, count });
}
