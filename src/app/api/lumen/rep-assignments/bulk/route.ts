import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";

// Assign several areas to one rep in a single request.
//
// Writes ordinary lumen_rep_assignments rows — the same rows the per-area
// "+ Add period" control has always written. This is a faster way in from a
// central screen, not a second place the org structure is stored.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;
  const rep = typeof body?.rep === "string" ? body.rep.trim() : "";
  const startMonth = Number(body?.startMonth);
  const endMonth = Number(body?.endMonth);
  const areas = Array.isArray(body?.areas)
    ? [...new Set(body.areas.filter((a: unknown): a is string => typeof a === "string" && a.trim() !== "").map((a: string) => a.trim()))]
    : [];

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!datasetId) {
    return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  }
  if (!rep) {
    return NextResponse.json({ error: "Missing rep" }, { status: 400 });
  }
  if (areas.length === 0) {
    return NextResponse.json({ error: "Pick at least one area" }, { status: 400 });
  }
  if (
    !Number.isInteger(startMonth) || !Number.isInteger(endMonth) ||
    startMonth < 1 || endMonth > 12 || startMonth > endMonth
  ) {
    return NextResponse.json({ error: "Invalid month range" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lumen_rep_assignments")
    .insert(
      areas.map((area) => ({
        dataset_id: datasetId,
        area,
        rep,
        year,
        start_month: startMonth,
        end_month: endMonth,
      })),
    )
    .select("id, area, rep, start_month, end_month");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    assignments: (data ?? []).map((a) => ({
      id: a.id as string,
      area: a.area as string,
      rep: a.rep as string | null,
      startMonth: Number(a.start_month),
      endMonth: Number(a.end_month),
    })),
  });
}
