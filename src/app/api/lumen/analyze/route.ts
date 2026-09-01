import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildReport, type SalesRecord } from "@/lib/lumen/engine";
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
      .from("lumen_sales_records")
      .select("area, family, sales_value, sales_qty, month, cluster, rep")
      .eq("year", year)
      .eq("dataset_id", datasetId)
      .range(from, to),
  );

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const records: SalesRecord[] = (data ?? []).map((r) => ({
    area: r.area as string,
    family: r.family as string,
    salesValue: Number(r.sales_value),
    salesQty: r.sales_qty !== null ? Number(r.sales_qty) : null,
    month: Number(r.month),
    cluster: r.cluster as string | null,
    rep: r.rep as string | null,
  }));

  const report = buildReport(records, year);
  return NextResponse.json(report);
}
