import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get("datasetId");
  if (!datasetId) {
    return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lumen_data_edits")
    .select("id, target_label, old_value, new_value, edited_by, created_at, is_undo")
    .eq("dataset_id", datasetId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    edits: (data ?? []).map((e) => ({
      id: e.id as string,
      targetLabel: e.target_label as string,
      oldValue: e.old_value as string,
      newValue: e.new_value as string,
      editedBy: e.edited_by as string | null,
      createdAt: e.created_at as string,
      isUndo: Boolean(e.is_undo),
    })),
  });
}
