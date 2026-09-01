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

  const { data, error } = await fetchAllRows((from, to) =>
    supabase
      .from("lumen_sales_records")
      .select("month, source_file")
      .eq("year", year)
      .eq("dataset_id", datasetId)
      .in("month", months)
      .range(from, to),
  );

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const overlappingMonths = Array.from(new Set((data ?? []).map((r) => r.month as number))).sort(
    (a, b) => a - b,
  );

  // Which file(s) the data that's about to be replaced actually came from —
  // shown in the replace-confirmation prompt so a leftover test/sample
  // upload sitting under a real month is obvious before deciding whether
  // to replace it, instead of only after the fact.
  const existingSourceFiles = Array.from(
    new Set((data ?? []).map((r) => r.source_file as string | null).filter((f): f is string => !!f)),
  ).sort();

  return NextResponse.json({ overlappingMonths, existingSourceFiles });
}
