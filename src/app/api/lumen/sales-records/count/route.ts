import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// A final sanity check after an upload finishes: how many rows actually
// exist right now for this dataset/year/months, so the client can compare
// against how many it expected to have inserted and warn loudly on any
// mismatch instead of trusting the upload silently.
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
  const months = (searchParams.get("months") ?? "")
    .split(",")
    .map(Number)
    .filter((m) => Number.isInteger(m));

  if (!Number.isInteger(year) || year < 2000 || year > 2100 || months.length === 0) {
    return NextResponse.json({ error: "Invalid year or months" }, { status: 400 });
  }
  if (!datasetId) {
    return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  }

  const { count, error } = await supabase
    .from("lumen_sales_records")
    .select("id", { count: "exact", head: true })
    .eq("year", year)
    .eq("dataset_id", datasetId)
    .in("month", months);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}
