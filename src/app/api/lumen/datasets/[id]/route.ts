import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TargetColumnMapping } from "@/lib/lumen/columnMapping";
import { isValidMapping } from "../route";

function isValidTargetMapping(m: unknown): m is TargetColumnMapping {
  if (!m || typeof m !== "object") return false;
  const mapping = m as Record<string, unknown>;
  if (typeof mapping.month !== "string" || mapping.month.trim() === "") return false;
  if (typeof mapping.value !== "string" || mapping.value.trim() === "") return false;
  for (const key of ["area", "rep", "item"]) {
    if (mapping[key] !== null && typeof mapping[key] !== "string") return false;
  }
  if (!mapping.area && !mapping.rep && !mapping.item) return false;
  return true;
}

// Saves the column mapping used for a dataset's Targets file, so
// re-uploading an updated targets file in the same format doesn't ask
// again — same idea as the sales column_mapping saved at dataset creation.
// Can also correct the dataset's own sales column_mapping directly — this
// only affects how future uploads to this dataset are parsed, since past
// rows already went through the old mapping and the original file isn't
// kept; fixing already-uploaded numbers still means re-uploading the
// affected month (the existing overlap/replace flow covers that).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing dataset id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const targetColumnMapping = body?.targetColumnMapping;
  const columnMapping = body?.columnMapping;

  const updates: Record<string, unknown> = {};
  if (targetColumnMapping !== undefined) {
    if (!isValidTargetMapping(targetColumnMapping)) {
      return NextResponse.json({ error: "Invalid target column mapping" }, { status: 400 });
    }
    updates.target_column_mapping = targetColumnMapping;
  }
  if (columnMapping !== undefined) {
    if (!isValidMapping(columnMapping)) {
      return NextResponse.json({ error: "Invalid column mapping" }, { status: 400 });
    }
    updates.column_mapping = columnMapping;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error, count } = await supabase
    .from("lumen_datasets")
    .update(updates, { count: "exact" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json(
      { error: "Dataset not found, or you don't have permission to edit it" },
      { status: 404 },
    );
  }

  return NextResponse.json({ updated: true });
}

// Deletes a dataset. lumen_sales_records.dataset_id has ON DELETE CASCADE
// (see supabase/lumen_datasets_migration.sql), so this also removes every
// row that was uploaded into it — deleting a dataset is permanent. RLS
// (see supabase/lumen_user_isolation_migration.sql) only lets this match
// a dataset the caller owns, so a delete for someone else's (or a shared
// legacy) dataset silently matches zero rows rather than erroring — that's
// reported back as a 404 instead of a false "success".
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing dataset id" }, { status: 400 });
  }

  const { error, count } = await supabase
    .from("lumen_datasets")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json(
      { error: "Dataset not found, or you don't have permission to delete it" },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true });
}
