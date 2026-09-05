import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";
import { fetchAllRows } from "@/lib/lumen/fetchAllRows";

// POST (not GET+query-string) because `areas` is free-text from the
// uploaded file and can contain commas, which would break a comma-joined
// query param.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;
  const months: number[] = Array.isArray(body?.months) ? body.months.filter((m: unknown) => Number.isInteger(m)) : [];
  const incomingAreas = new Set<string>(Array.isArray(body?.areas) ? body.areas.filter((a: unknown) => typeof a === "string") : []);

  if (!Number.isInteger(year) || year < 2000 || year > 2100 || months.length === 0) {
    return NextResponse.json({ error: "Invalid year or months" }, { status: 400 });
  }
  if (!datasetId) {
    return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  }

  const { data, error } = await fetchAllRows(() =>
    supabase
      .from("lumen_sales_records")
      .select("month, area, source_file, sales_value")
      .eq("year", year)
      .eq("dataset_id", datasetId)
      .in("month", months),
  );

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const rows = data ?? [];

  const overlappingMonths = Array.from(new Set(rows.map((r) => r.month as number))).sort((a, b) => a - b);

  // Which file(s) the data that's about to be replaced actually came from —
  // shown in the replace-confirmation prompt so a leftover test/sample
  // upload sitting under a real month is obvious before deciding whether
  // to replace it, instead of only after the fact.
  const existingSourceFiles = Array.from(
    new Set(rows.map((r) => r.source_file as string | null).filter((f): f is string => !!f)),
  ).sort();

  // Areas that currently have data for one of these months but the
  // incoming file doesn't mention at all. Replacing a month deletes EVERY
  // area's rows for it (not just the ones in the new file), so an area
  // missing from the new file would have its data deleted with nothing to
  // replace it — permanently, with no warning, unless flagged here. This
  // is exactly the shape of mistake that produced a real production
  // anomaly: a smaller file (fewer areas, or a test/sample export)
  // silently wiping out other areas' real numbers for the same month.
  const atRiskTotals = new Map<string, { rowCount: number; totalValue: number }>();
  if (incomingAreas.size > 0) {
    for (const r of rows) {
      const area = r.area as string;
      if (incomingAreas.has(area)) continue;
      const entry = atRiskTotals.get(area) ?? { rowCount: 0, totalValue: 0 };
      entry.rowCount += 1;
      entry.totalValue += (r.sales_value as number) ?? 0;
      atRiskTotals.set(area, entry);
    }
  }
  const areasAtRisk = Array.from(atRiskTotals.entries())
    .map(([area, v]) => ({ area, ...v }))
    .sort((a, b) => b.totalValue - a.totalValue);

  return NextResponse.json({ overlappingMonths, existingSourceFiles, areasAtRisk });
}
