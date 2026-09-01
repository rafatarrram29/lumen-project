import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/lumen/fetchAllRows";

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const datasetId = searchParams.get("datasetId");

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!datasetId) {
    return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  }

  const { data, error } = await fetchAllRows((from, to) =>
    supabase
      .from("lumen_dataset_records")
      .select("id, file_id, area, rep, line, month, data, is_edited, edited_at, edited_by")
      .eq("year", year)
      .eq("dataset_id", datasetId)
      .range(from, to),
  );

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({
    records: (data ?? []).map((r) => ({
      id: r.id as string,
      fileId: r.file_id as string,
      area: r.area as string | null,
      rep: r.rep as string | null,
      line: r.line as string | null,
      month: Number(r.month),
      data: r.data as Record<string, unknown>,
      isEdited: Boolean(r.is_edited),
      editedAt: r.edited_at as string | null,
      editedBy: r.edited_by as string | null,
    })),
  });
}
