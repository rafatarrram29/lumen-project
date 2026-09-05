import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";
import type { JoinKey } from "@/lib/lumen/linkedFiles";

const VALID_KEYS: JoinKey[] = ["area", "rep", "line", "month"];

// Corrects which already-stored dimensions (area/rep/line/month) this
// file is matched by, without touching its rows — safe and instant,
// because those columns were already extracted from the file at upload
// time. Fixing which SOURCE column feeds one of those dimensions instead
// requires a full re-upload (the Replace flow), since the raw file isn't
// kept.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing file id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 200) : null;
  const joinKeys: unknown = body?.joinKeys;

  const updates: Record<string, unknown> = {};
  if (displayName) updates.display_name = displayName;
  if (joinKeys !== undefined) {
    if (!Array.isArray(joinKeys) || joinKeys.length === 0 || !joinKeys.every((k) => VALID_KEYS.includes(k))) {
      return NextResponse.json({ error: "Invalid join keys" }, { status: 400 });
    }
    updates.join_keys = joinKeys;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error, count } = await supabase
    .from("lumen_dataset_files")
    .update(updates, { count: "exact" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json(
      { error: "File not found, or you don't have permission to edit it" },
      { status: 404 },
    );
  }

  return NextResponse.json({ updated: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing file id" }, { status: 400 });
  }

  const { error, count } = await supabase
    .from("lumen_dataset_files")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json(
      { error: "File not found, or you don't have permission to delete it" },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true });
}
