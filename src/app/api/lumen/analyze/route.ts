import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadReport } from "@/lib/lumen/loadReport";

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

  // Same code path the server-rendered first paint uses, so the two can't
  // disagree about what the dashboard should show.
  const { payload, error } = await loadReport(supabase, datasetId, year);

  if (error || !payload) {
    return NextResponse.json({ error: error ?? "Could not build the report" }, { status: 500 });
  }

  return NextResponse.json(payload);
}
