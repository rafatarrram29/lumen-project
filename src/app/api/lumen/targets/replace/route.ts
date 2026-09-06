import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";

// A targets file represents the current plan, not a history of edits, so
// uploading a new one replaces the existing target rows rather than asking
// about per-month overlap like the sales upload does.
//
// WHAT it replaces depends on where the upload started. From the sidebar
// it is the whole dataset+year, as it always was. From inside a rep's or
// an area's card it must be that scope alone: wiping the whole plan
// because one rep re-uploaded theirs would silently delete five other
// reps' targets, and nothing on screen would say so.
//
// Manually typed rows are never deleted by either. Someone corrected that
// figure on purpose; re-uploading the plan file is not a request to undo
// it (and the card marks such a figure so it is clear why it survived).
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;
  const scopeRep = typeof body?.scopeRep === "string" && body.scopeRep.trim() !== "" ? body.scopeRep.trim() : null;
  const scopeArea = typeof body?.scopeArea === "string" && body.scopeArea.trim() !== "" ? body.scopeArea.trim() : null;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!datasetId) {
    return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  }

  let query = supabase
    .from("lumen_targets")
    .delete({ count: "exact" })
    .eq("year", year)
    .eq("dataset_id", datasetId)
    .eq("is_manual", false);

  if (scopeRep) query = query.eq("rep", scopeRep);
  if (scopeArea) query = query.eq("area", scopeArea);

  const { error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: count ?? 0 });
}
