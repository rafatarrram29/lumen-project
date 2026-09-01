import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findDuplicateKeys, POSTGRES_UNIQUE_VIOLATION } from "@/lib/lumen/duplicateCheck";

const MAX_ROWS_PER_REQUEST = 5000;

type IncomingRow = { area: string; product: string; company: string | null; marketShare: number; month: number };

// Appends a batch of parsed IMS rows to an already-created IMS file
// (mirrors the dataset-create -> upload-rows split used for the primary
// sales file and for linked files).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: fileId } = await params;
  if (!fileId) {
    return NextResponse.json({ error: "Missing file id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;
  const year = Number(body?.year);
  const rows: IncomingRow[] = Array.isArray(body?.rows) ? body.rows : [];

  if (!datasetId) return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (rows.length === 0) return NextResponse.json({ error: "No rows to insert" }, { status: 400 });
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
        typeof r.area === "string" &&
        typeof r.product === "string" &&
        typeof r.marketShare === "number" &&
        Number.isFinite(r.marketShare) &&
        Number.isInteger(r.month),
    )
    .map((r) => ({
      dataset_id: datasetId,
      file_id: fileId,
      area: r.area,
      product: r.product,
      company: typeof r.company === "string" ? r.company : null,
      market_share: r.marketShare,
      month: r.month,
      year,
      uploaded_at: uploadedAt,
    }));

  if (records.length === 0) {
    return NextResponse.json({ error: "No valid rows in payload" }, { status: 400 });
  }

  // Same principle as the sales upload's duplicate check: key on the full
  // row including the measured value, not just area/product/month/company
  // — a real IMS export can have several genuinely distinct rows sharing
  // those (a finer time slice, a repeated audit), and only a byte-identical
  // row is an actual duplicate.
  const duplicates = findDuplicateKeys(
    records,
    (r) => `${r.dataset_id}|${r.year}|${r.month}|${r.area}|${r.product}|${r.company ?? ""}|${r.market_share}`,
  );
  if (duplicates.length > 0) {
    return NextResponse.json(
      {
        error:
          `This batch has ${duplicates.length} row(s) repeated more than once, identical in every column ` +
          `— check the source file for an accidentally repeated row, or if this is a re-upload of a month you ` +
          `already have, delete and re-add the file instead of adding to it.`,
      },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("lumen_ims_records").insert(records);
  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      return NextResponse.json(
        { error: "Some of these rows are identical, in every column, to rows already in this file." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: records.length });
}
