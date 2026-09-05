import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";

const MAX_ROWS_PER_REQUEST = 5000;

type IncomingTargetRow = {
  area: string | null;
  rep: string | null;
  item: string | null;
  month: number;
  targetValue: number;
};

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;
  const rows: IncomingTargetRow[] = Array.isArray(body?.rows) ? body.rows : [];

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
        (r.area || r.rep || r.item),
    )
    .map((r) => ({
      area: typeof r.area === "string" ? r.area : null,
      rep: typeof r.rep === "string" ? r.rep : null,
      item: typeof r.item === "string" ? r.item : null,
      month: r.month,
      year,
      target_value: r.targetValue,
      uploaded_at: uploadedAt,
      dataset_id: datasetId,
    }));

  if (records.length === 0) {
    return NextResponse.json({ error: "No valid rows in payload" }, { status: 400 });
  }

  const { error } = await supabase.from("lumen_targets").insert(records);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: records.length });
}
