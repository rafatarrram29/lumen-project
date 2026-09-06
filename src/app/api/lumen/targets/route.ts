import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";

const MAX_ROWS_PER_REQUEST = 5000;

type IncomingTargetRow = {
  area: string | null;
  rep: string | null;
  item: string | null;
  month: number;
  targetValue: number;
  /** The plan file's own achievement %, when it had one. */
  achPct?: number | null;
};

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;
  const rows: IncomingTargetRow[] = Array.isArray(body?.rows) ? body.rows : [];
  // Where the upload was started from. A file uploaded from inside a rep's
  // card does not need a Rep column — the card already said whose plan it
  // is — so any row that names neither a rep nor an area is filed under
  // the scope. A row that DOES name one keeps its own: the file is the
  // more specific statement, and the dialog has already asked about the
  // disagreement before getting here.
  const scopeRep = typeof body?.scopeRep === "string" && body.scopeRep.trim() !== "" ? body.scopeRep.trim() : null;
  const scopeArea = typeof body?.scopeArea === "string" && body.scopeArea.trim() !== "" ? body.scopeArea.trim() : null;
  const sourceFile = typeof body?.sourceFile === "string" ? body.sourceFile : null;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!datasetId) {
    return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to insert" }, { status: 400 });
  }
  if (rows.length > MAX_ROWS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Too many rows in one request (max ${MAX_ROWS_PER_REQUEST}); the client should send this in batches.` },
      { status: 400 },
    );
  }

  const uploadedAt = new Date().toISOString();
  const records = rows
    .filter(
      (r) =>
        Number.isInteger(r.month) &&
        typeof r.targetValue === "number" &&
        Number.isFinite(r.targetValue) &&
        (r.area || r.rep || r.item || scopeRep || scopeArea),
    )
    .map((r) => {
      const area = typeof r.area === "string" ? r.area : null;
      const rep = typeof r.rep === "string" ? r.rep : null;
      const named = Boolean(area || rep);
      return {
        area: named ? area : scopeArea,
        rep: named ? rep : scopeRep,
        item: typeof r.item === "string" ? r.item : null,
        month: r.month,
        year,
        target_value: r.targetValue,
        ach_pct: typeof r.achPct === "number" && Number.isFinite(r.achPct) ? r.achPct : null,
        is_manual: false,
        source_file: sourceFile,
        uploaded_at: uploadedAt,
        dataset_id: datasetId,
      };
    });

  if (records.length === 0) {
    return NextResponse.json({ error: "No valid rows in payload" }, { status: 400 });
  }

  const { error } = await supabase.from("lumen_targets").insert(records);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: records.length });
}
