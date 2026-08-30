import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const months = (searchParams.get("months") ?? "")
    .split(",")
    .map(Number)
    .filter((m) => Number.isInteger(m));

  if (!Number.isInteger(year) || year < 2000 || year > 2100 || months.length === 0) {
    return NextResponse.json({ error: "Invalid year or months" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lumen_sales_records")
    .select("month")
    .eq("year", year)
    .in("month", months);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const overlappingMonths = Array.from(new Set((data ?? []).map((r) => r.month as number))).sort(
    (a, b) => a - b,
  );

  return NextResponse.json({ overlappingMonths });
}
