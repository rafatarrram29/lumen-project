import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing link id" }, { status: 400 });
  }

  const { error, count } = await supabase
    .from("lumen_district_managers")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json(
      { error: "Link not found, or you don't have permission to delete it" },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true });
}
