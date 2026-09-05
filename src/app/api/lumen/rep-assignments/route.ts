import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";

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

  const { data, error } = await supabase
    .from("lumen_rep_assignments")
    .select("id, area, rep, start_month, end_month")
    .eq("year", year)
    .eq("dataset_id", datasetId)
    .order("area", { ascending: true })
    .order("start_month", { ascending: true });

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

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;
  const area = typeof body?.area === "string" ? body.area.trim() : "";
  const rep = typeof body?.rep === "string" && body.rep.trim() !== "" ? body.rep.trim() : null;
  const startMonth = Number(body?.startMonth);
  const endMonth = Number(body?.endMonth);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!datasetId) {
    return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  }
  if (!area) {
    return NextResponse.json({ error: "Missing area" }, { status: 400 });
  }
  if (!Number.isInteger(startMonth) || !Number.isInteger(endMonth) || startMonth < 1 || endMonth > 12 || startMonth > endMonth) {
    return NextResponse.json({ error: "Invalid month range" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lumen_rep_assignments")
    .insert({ dataset_id: datasetId, area, rep, year, start_month: startMonth, end_month: endMonth })
    .select("id, area, rep, start_month, end_month")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    assignment: {
      id: data.id as string,
      area: data.area as string,
      rep: data.rep as string | null,
      startMonth: Number(data.start_month),
      endMonth: Number(data.end_month),
    },
  });
}
