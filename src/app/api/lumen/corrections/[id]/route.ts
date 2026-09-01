import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    return NextResponse.json({ error: "Missing correction id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (status !== "open" && status !== "resolved") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error, count } = await supabase
    .from("lumen_corrections")
    .update({ status, resolved_at: status === "resolved" ? new Date().toISOString() : null }, { count: "exact" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json(
      { error: "Correction not found, or you don't have permission to edit it" },
      { status: 404 },
    );
  }

  return NextResponse.json({ updated: true });
}
