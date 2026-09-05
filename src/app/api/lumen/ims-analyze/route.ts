import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";
import { buildImsReport, type ImsRecord } from "@/lib/lumen/imsEngine";
import { buildReport, type SalesRecord } from "@/lib/lumen/engine";
import { fetchAllRows } from "@/lib/lumen/fetchAllRows";
import { readSalesRows } from "@/lib/lumen/loadReport";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const datasetId = searchParams.get("datasetId");

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!datasetId) {
    return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  }

  // Three independent queries — IMS rows, the IMS file(s)' own_company
  // setting, and this dataset's sales rows (for the sales-vs-share
  // insight) — fetched concurrently.
  const [{ data: imsData, error: imsError }, { data: filesData }, { data: salesData }] = await Promise.all([
    fetchAllRows(() =>
      supabase
        .from("lumen_ims_records")
        .select("area, product, company, market_share, month, growth_rate")
        .eq("year", year)
        .eq("dataset_id", datasetId),
    ),
    supabase
      .from("lumen_ims_files")
      .select("own_company, created_at")
      .eq("dataset_id", datasetId)
      .order("created_at", { ascending: false }),
    // The same database-side aggregate the sales dashboard reads through —
    // this route needs the identical totals, and reading raw transaction
    // rows here would reintroduce exactly the payload this replaced.
    readSalesRows(supabase, datasetId, year),
  ]);

  if (imsError) {
    return NextResponse.json({ error: imsError }, { status: 500 });
  }

  const records: ImsRecord[] = (imsData ?? []).map((r) => ({
    area: r.area as string | null,
    product: r.product as string | null,
    company: r.company as string | null,
    marketShare: Number(r.market_share),
    month: Number(r.month),
    growthRate: r.growth_rate != null ? Number(r.growth_rate) : null,
  }));

  // Every file's own_company, not just the first one set — a dataset with
  // several IMS files almost always has a different own-brand name per
  // product/molecule, and treating only one of them as "us" would silently
  // misclassify every other file's own rows as competitors.
  const ownCompanies = Array.from(
    new Set((filesData ?? []).map((f) => f.own_company).filter((c): c is string => c != null)),
  );

  let salesAreaPctChange: Record<string, number | null> | undefined;
  if ((salesData ?? []).length > 0) {
    const salesRecords: SalesRecord[] = (salesData ?? []).map((r) => ({
      area: r.area as string,
      family: r.family as string,
      salesValue: Number(r.sales_value),
      salesQty: r.sales_qty !== null ? Number(r.sales_qty) : null,
      month: Number(r.month),
      line: r.line as string | null,
      rep: r.rep as string | null,
    }));
    const salesReport = buildReport(salesRecords, year);
    if (!("error" in salesReport)) {
      salesAreaPctChange = Object.fromEntries(
        Object.entries(salesReport.areas).map(([area, d]) => [area, d.pctChange]),
      );
    }
  }

  const report = buildImsReport(records, ownCompanies, salesAreaPctChange);

  return NextResponse.json({ ...report, hasIms: records.length > 0, hasSales: (salesData ?? []).length > 0 });
}
