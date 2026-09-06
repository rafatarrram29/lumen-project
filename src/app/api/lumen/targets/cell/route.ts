import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";

// Types in, or corrects, one target figure: one scope, one item, one
// month.
//
// The plan file is often the thing that is wrong — a row missed, a number
// mistyped — and re-exporting it from whatever produced it is not a
// two-minute job. So a target can be fixed where it is read, the same way
// a sales figure already can (see sales-records/cell), and lands in the
// same Correction log.
//
// Rows written here are flagged is_manual, which does two things: the card
// marks them, and a later upload for the same scope leaves them alone.
export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const body = await request.json().catch(() => null);
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;
  const year = Number(body?.year);
  const month = Number(body?.month);
  const item = typeof body?.item === "string" && body.item.trim() !== "" ? body.item.trim() : null;
  const rep = typeof body?.rep === "string" && body.rep.trim() !== "" ? body.rep.trim() : null;
  const area = typeof body?.area === "string" && body.area.trim() !== "" ? body.area.trim() : null;
  const newValue = Number(body?.newValue);
  const isUndo = body?.isUndo === true;

  if (!datasetId) return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  if (!Number.isInteger(year)) return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }
  if (!item) return NextResponse.json({ error: "Missing item" }, { status: 400 });
  if (!rep && !area) return NextResponse.json({ error: "Missing rep or area" }, { status: 400 });
  if (!Number.isFinite(newValue) || newValue < 0) {
    return NextResponse.json({ error: "Invalid newValue" }, { status: 400 });
  }

  // What this cell is worth today: the uploaded rows plus any earlier
  // manual correction. The whole cell is replaced, so the old total is
  // what the Correction log records as the previous value.
  let existing = supabase
    .from("lumen_targets")
    .select("id, target_value, is_manual")
    .eq("dataset_id", datasetId)
    .eq("year", year)
    .eq("month", month)
    .eq("item", item);
  existing = rep ? existing.eq("rep", rep) : existing.is("rep", null);
  existing = area ? existing.eq("area", area) : existing.is("area", null);

  const { data: rows, error: selectError } = await existing;
  if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });

  const oldTotal = (rows ?? []).reduce((sum, r) => sum + Number(r.target_value), 0);
  const editedAt = new Date().toISOString();
  const editedBy = user.email ?? user.id;

  // One manual row stands for the cell. Any uploaded rows behind it go:
  // leaving them would add the old figure back on top of the new one.
  const manual = (rows ?? []).find((r) => r.is_manual);
  const stale = (rows ?? []).filter((r) => r.id !== manual?.id).map((r) => r.id as string);
  if (stale.length > 0) {
    const { error } = await supabase.from("lumen_targets").delete().in("id", stale);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (manual) {
    const { error } = await supabase
      .from("lumen_targets")
      .update({ target_value: newValue, ach_pct: null, edited_by: editedBy, edited_at: editedAt })
      .eq("id", manual.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("lumen_targets").insert({
      dataset_id: datasetId,
      area,
      rep,
      item,
      month,
      year,
      target_value: newValue,
      ach_pct: null,
      is_manual: true,
      edited_by: editedBy,
      edited_at: editedAt,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const scopeLabel = [rep, area].filter(Boolean).join(" · ");
  const { error: logError } = await supabase.from("lumen_data_edits").insert({
    dataset_id: datasetId,
    target_label: `Target · ${scopeLabel} · ${item} · ${year}-${String(month).padStart(2, "0")}`,
    old_value: String(oldTotal),
    new_value: String(newValue),
    edited_by: editedBy,
    is_undo: isUndo,
  });
  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 });

  return NextResponse.json({ updated: true, oldValue: oldTotal, newValue });
}
