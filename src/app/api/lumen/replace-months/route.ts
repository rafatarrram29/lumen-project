import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Deletes existing rows for the given dataset/year/months before a
// re-upload, so re-ingesting a corrected file replaces the old data
// instead of stacking a duplicate copy on top of it. Scoped to a single
// dataset_id — re-uploading into one dataset never touches another.
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;
  const months: number[] = Array.isArray(body?.months)
    ? body.months.filter((m: unknown) => Number.isInteger(m))
    : [];

  if (!Number.isInteger(year) || year < 2000 || year > 2100 || months.length === 0) {
    return NextResponse.json({ error: "Invalid year or months" }, { status: 400 });
  }
  if (!datasetId) {
    return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  }

  const { error, count } = await supabase
    .from("lumen_sales_records")
    .delete({ count: "exact" })
    .eq("year", year)
    .eq("dataset_id", datasetId)
    .in("month", months);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: count ?? 0 });
}
