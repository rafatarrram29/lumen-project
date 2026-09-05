import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";

// Inline-edits a single field inside one linked-file row's `data` blob
// (Achievement, KPIs, or any other linked file type). Linked files are a
// "linked display" layer only (see lumen_linked_files_migration.sql) — no
// analysis depends on them — so unlike the sales-cell edit, there is
// nothing else to recompute; the edited value just needs to persist and
// be flagged as edited.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing record id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key : null;
  const rawNewValue = body?.newValue;
  const isUndo = body?.isUndo === true;

  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });
  if (typeof rawNewValue !== "string" && typeof rawNewValue !== "number") {
    return NextResponse.json({ error: "Invalid newValue" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from("lumen_dataset_records")
    .select("dataset_id, data")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: "Record not found, or you don't have permission to edit it" },
      { status: 404 },
    );
  }

  const data = { ...(existing.data as Record<string, unknown>) };
  const oldValue = data[key];
  // Preserve the original value's type (number stays a number) when the
  // new value parses cleanly as one, so downstream display formatting
  // doesn't flip from numeric to text on an edit.
  const parsedNumber = Number(rawNewValue);
  const newValue =
    typeof oldValue === "number" && rawNewValue !== "" && !Number.isNaN(parsedNumber) ? parsedNumber : rawNewValue;
  data[key] = newValue;

  const editedAt = new Date().toISOString();
  const editedBy = user.email ?? user.id;

  const { error: updateError, count } = await supabase
    .from("lumen_dataset_records")
    .update({ data, is_edited: true, edited_at: editedAt, edited_by: editedBy }, { count: "exact" })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json(
      { error: "Record not found, or you don't have permission to edit it" },
      { status: 404 },
    );
  }

  const { error: logError } = await supabase.from("lumen_data_edits").insert({
    dataset_id: existing.dataset_id,
    target_label: `${key}`,
    old_value: String(oldValue ?? ""),
    new_value: String(newValue),
    edited_by: editedBy,
    is_undo: isUndo,
  });
  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  return NextResponse.json({ updated: true, oldValue, newValue });
}
