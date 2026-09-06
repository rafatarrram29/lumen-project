import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";
import { fetchAllRows } from "@/lib/lumen/fetchAllRows";
import { buildProgress, rollUpTeam, type ActualRow, type TargetRow } from "@/lib/lumen/targetProgress";

// Target vs Achievement for one slice of the org chart — one rep, one
// area, or a whole team.
//
// Its own endpoint rather than another field on the report, for the same
// reason /api/lumen/org-items is: the comparison needs month x item detail
// for the scope, and carrying that for every rep and every area in the
// main payload is exactly the weight the database-side aggregate removed.
// A card is opened deliberately, one at a time, so its plan is fetched
// then.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  // POST, not GET: rep and area names are free text from an uploaded file
  // and routinely contain commas, which a comma-joined query parameter
  // would split down the middle.
  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;
  const threshold = Number.isFinite(Number(body?.threshold)) ? Number(body.threshold) : 70;
  /** One entry per rep for a manager's card; a single entry for one rep or area. */
  const scopes: { rep?: string | null; areas?: string[] }[] = Array.isArray(body?.scopes) ? body.scopes : [];

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!datasetId) {
    return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  }
  if (scopes.length === 0) {
    return NextResponse.json({ error: "No scopes given" }, { status: 400 });
  }

  const [sales, targets] = await Promise.all([
    fetchAllRows<{ area: string; family: string; rep: string | null; month: number; sales_value: number }>(() =>
      supabase
        .from("lumen_sales_records")
        .select("area, family, rep, month, sales_value")
        .eq("year", year)
        .eq("dataset_id", datasetId),
    ),
    fetchAllRows<{
      area: string | null;
      rep: string | null;
      item: string | null;
      month: number;
      target_value: number;
      ach_pct: number | null;
      is_manual: boolean;
    }>(() =>
      supabase
        .from("lumen_targets")
        .select("area, rep, item, month, target_value, ach_pct, is_manual")
        .eq("year", year)
        .eq("dataset_id", datasetId),
    ),
  ]);

  if (sales.error) return NextResponse.json({ error: sales.error }, { status: 500 });
  if (targets.error) return NextResponse.json({ error: targets.error }, { status: 500 });

  const actualRows: ActualRow[] = sales.data.map((r) => ({
    area: r.area,
    item: r.family,
    rep: r.rep,
    month: Number(r.month),
    value: Number(r.sales_value),
  }));
  const targetRows: TargetRow[] = targets.data.map((r) => ({
    area: r.area,
    rep: r.rep,
    item: r.item,
    month: Number(r.month),
    targetValue: Number(r.target_value),
    achPct: r.ach_pct === null || r.ach_pct === undefined ? null : Number(r.ach_pct),
    isManual: Boolean(r.is_manual),
  }));

  const members = scopes.map((s) => ({
    rep: s.rep ?? (s.areas ?? []).join(", "),
    progress: buildProgress(actualRows, targetRows, { rep: s.rep ?? null, areas: s.areas ?? [] }),
  }));

  // One scope answers for itself; several are a team, and a team's
  // achievement is total over total — see rollUpTeam.
  return NextResponse.json({
    members,
    team: members.length > 1 ? rollUpTeam(members, threshold) : null,
    hasAnyTarget: targetRows.length > 0,
  });
}
