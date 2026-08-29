import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildReport, type SalesRecord } from "@/lib/lumen/engine";

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
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lumen_sales_records")
    .select("area, family, sales_value, month")
    .eq("year", year);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const records: SalesRecord[] = (data ?? []).map((r) => ({
    area: r.area as string,
    family: r.family as string,
    salesValue: Number(r.sales_value),
    month: Number(r.month),
  }));

  const report = buildReport(records, year);
  return NextResponse.json(report);
}
