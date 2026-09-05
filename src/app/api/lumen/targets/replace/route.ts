import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";

// A targets file represents the current plan, not a history of edits, so
// uploading a new one wholesale replaces every existing target row for
// that dataset+year rather than asking about per-month overlap like the
// sales upload does.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!datasetId) {
    return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  }

  const { error, count } = await supabase
    .from("lumen_targets")
    .delete({ count: "exact" })
    .eq("year", year)
    .eq("dataset_id", datasetId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: count ?? 0 });
}
