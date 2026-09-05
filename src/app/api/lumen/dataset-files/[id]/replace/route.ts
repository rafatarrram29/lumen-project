import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";

// A linked file, like the Targets file, represents the current state of
// that file — re-uploading it (optionally with a corrected mapping or
// join keys) wholesale replaces its previously stored rows.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const { id: fileId } = await params;
  if (!fileId) {
    return NextResponse.json({ error: "Missing file id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 200) : null;
  const columnMapping = body?.columnMapping ?? null;
  const joinKeys = Array.isArray(body?.joinKeys) ? body.joinKeys : null;

  const { error: deleteError, count } = await supabase
    .from("lumen_dataset_records")
    .delete({ count: "exact" })
    .eq("file_id", fileId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (displayName || columnMapping || joinKeys) {
    const updates: Record<string, unknown> = {};
    if (displayName) updates.display_name = displayName;
    if (columnMapping) updates.column_mapping = columnMapping;
    if (joinKeys) updates.join_keys = joinKeys;

    const { error: updateError } = await supabase.from("lumen_dataset_files").update(updates).eq("id", fileId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ deleted: count ?? 0 });
}
