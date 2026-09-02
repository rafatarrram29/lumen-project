import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dedupeExactDuplicates, POSTGRES_UNIQUE_VIOLATION } from "@/lib/lumen/duplicateCheck";

const MAX_ROWS_PER_REQUEST = 5000;

type IncomingRow = { area: string | null; rep: string | null; line: string | null; month: number; data: Record<string, unknown> };

// Appends a batch of rows to an already-created linked file (mirrors the
// dataset-create -> upload-rows split used for the primary sales file).
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
  const clientDuplicatesRemoved: { count: number; examples: string[] } | null =
    body?.duplicatesRemoved && typeof body.duplicatesRemoved.count === "number"
      ? { count: body.duplicatesRemoved.count, examples: Array.isArray(body.duplicatesRemoved.examples) ? body.duplicatesRemoved.examples : [] }
      : null;

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
    .filter((r) => Number.isInteger(r.month) && r.data && typeof r.data === "object")
    .map((r) => ({
      dataset_id: datasetId,
      file_id: fileId,
      area: typeof r.area === "string" ? r.area : null,
      rep: typeof r.rep === "string" ? r.rep : null,
      line: typeof r.line === "string" ? r.line : null,
      month: r.month,
      year,
      data: r.data,
      uploaded_at: uploadedAt,
    }));

  if (records.length === 0) {
    return NextResponse.json({ error: "No valid rows in payload" }, { status: 400 });
  }

  // An exact repeat of a row within this same batch is a source-file
  // accident, not a decision the uploader needs to make — drop it and
  // insert the rest (the client already dedupes the whole file before
  // batching; this is a defensive backstop for any caller that doesn't).
  // Keyed on the row's full data payload, not just its join dimensions —
  // a linked file can legitimately have several distinct rows sharing
  // the same area/rep/line/month (different metrics, a finer source
  // granularity, etc.), and only an exact full-row repeat is an actual
  // duplicate. A NEW upload colliding with rows already committed from
  // an EARLIER one is a different case entirely, still caught below by
  // POSTGRES_UNIQUE_VIOLATION.
  const { kept, removed: batchDuplicatesRemoved } = dedupeExactDuplicates(
    records,
    (r) => `${r.file_id}|${r.year}|${r.month}|${r.area ?? ""}|${r.rep ?? ""}|${r.line ?? ""}|${JSON.stringify(r.data)}`,
    (r) => `${r.area ?? "—"} / month ${r.month}`,
  );

  const { error } = await supabase.from("lumen_dataset_records").insert(kept);
  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      return NextResponse.json(
        { error: "Some of these rows are identical, in every column, to rows already in this file." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const totalRemoved = (clientDuplicatesRemoved?.count ?? 0) + batchDuplicatesRemoved.count;
  if (totalRemoved > 0) {
    const examples = [...(clientDuplicatesRemoved?.examples ?? []), ...batchDuplicatesRemoved.examples].slice(0, 5);
    await supabase.from("lumen_data_edits").insert({
      dataset_id: datasetId,
      target_label: `Linked file upload: ${totalRemoved} duplicate row(s) removed automatically`,
      old_value: `${totalRemoved} duplicate row(s) found`,
      new_value: `kept one copy of each — e.g. ${examples.join("; ") || "an identical repeated row"}`,
      edited_by: user.email ?? user.id,
      is_undo: false,
    });
  }

  return NextResponse.json({ inserted: kept.length });
}
