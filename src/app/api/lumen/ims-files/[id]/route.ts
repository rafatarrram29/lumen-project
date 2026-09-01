import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Corrects an IMS file's display name or which value in its company
// column is "ours" — without touching its rows.
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
    return NextResponse.json({ error: "Missing file id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 200) : null;
  const ownCompany = body?.ownCompany;

  const updates: Record<string, unknown> = {};
  if (displayName) updates.display_name = displayName;
  if (ownCompany !== undefined) {
    if (ownCompany !== null && typeof ownCompany !== "string") {
      return NextResponse.json({ error: "Invalid ownCompany" }, { status: 400 });
    }
    updates.own_company = ownCompany;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error, count } = await supabase
    .from("lumen_ims_files")
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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing file id" }, { status: 400 });
  }

  const { error, count } = await supabase
    .from("lumen_ims_files")
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
