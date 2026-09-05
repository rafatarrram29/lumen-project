import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";

function readLinks(data: { id: unknown; manager: unknown; rep: unknown }[] | null) {
  return (data ?? []).map((l) => ({
    id: l.id as string,
    manager: l.manager as string,
    rep: l.rep as string,
  }));
}

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
    .from("lumen_district_managers")
    .select("id, manager, rep")
    .eq("year", year)
    .eq("dataset_id", datasetId)
    .order("manager", { ascending: true })
    .order("rep", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ links: readLinks(data) });
}

// Put several reps under one manager.
//
// A rep reports to exactly one manager, so moving a rep to a new manager
// means removing the old link first. That is done here rather than left to
// the unique constraint to reject, so re-assigning someone is a normal
// action rather than an error the user has to work around.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;
  const manager = typeof body?.manager === "string" ? body.manager.trim() : "";
  const reps = Array.isArray(body?.reps)
    ? [...new Set(body.reps.filter((r: unknown): r is string => typeof r === "string" && r.trim() !== "").map((r: string) => r.trim()))]
    : [];

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!datasetId) {
    return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  }
  if (!manager) {
    return NextResponse.json({ error: "Missing manager" }, { status: 400 });
  }
  if (reps.length === 0) {
    return NextResponse.json({ error: "Pick at least one rep" }, { status: 400 });
  }

  const { error: clearError } = await supabase
    .from("lumen_district_managers")
    .delete()
    .eq("dataset_id", datasetId)
    .eq("year", year)
    .in("rep", reps);

  if (clearError) {
    return NextResponse.json({ error: clearError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("lumen_district_managers")
    .insert(reps.map((rep) => ({ dataset_id: datasetId, manager, rep, year })))
    .select("id, manager, rep");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ links: readLinks(data) });
}
