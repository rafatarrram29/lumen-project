import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dedupeExactDuplicates, POSTGRES_UNIQUE_VIOLATION } from "@/lib/lumen/duplicateCheck";

const MAX_ROWS_PER_REQUEST = 5000;

type IncomingRow = {
  area: string;
  item: string;
  family: string;
  salesQty: number | null;
  salesValue: number;
  month: number;
  rep: string | null;
  line: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;
  const sourceFile = typeof body?.sourceFile === "string" ? body.sourceFile.slice(0, 300) : null;
  const rows: IncomingRow[] = Array.isArray(body?.rows) ? body.rows : [];
  // The client already dedupes the whole file before splitting it into
  // batches (see uploadRowsToDataset in LumenClient.tsx) and reports what
  // it found/removed here, on the first batch only, purely so this route
  // can log it — this field never changes what gets inserted.
  const clientDuplicatesRemoved: { count: number; examples: string[] } | null =
    body?.duplicatesRemoved && typeof body.duplicatesRemoved.count === "number"
      ? { count: body.duplicatesRemoved.count, examples: Array.isArray(body.duplicatesRemoved.examples) ? body.duplicatesRemoved.examples : [] }
      : null;

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
        typeof r.area === "string" &&
        typeof r.item === "string" &&
        typeof r.family === "string" &&
        typeof r.salesValue === "number" &&
        Number.isFinite(r.salesValue) &&
        Number.isInteger(r.month),
    )
    .map((r) => ({
      area: r.area,
      item: r.item,
      family: r.family,
      sales_qty: typeof r.salesQty === "number" && Number.isFinite(r.salesQty) ? r.salesQty : null,
      sales_value: r.salesValue,
      month: r.month,
      year,
      uploaded_at: uploadedAt,
      source_file: sourceFile,
      dataset_id: datasetId,
      rep: typeof r.rep === "string" ? r.rep : null,
      line: typeof r.line === "string" ? r.line : null,
    }));

  if (records.length === 0) {
    return NextResponse.json({ error: "No valid rows in payload" }, { status: 400 });
  }

  // An exact full duplicate row within this SAME batch (same area/item/
  // month/rep AND the same sales_value/sales_qty) is a source-file
  // accident, not a decision the uploader needs to make — drop it and
  // insert the rest. This is a defensive backstop: the client already
  // dedupes the whole file before splitting it into batches, so this
  // should rarely find anything, but any caller that doesn't pre-dedupe
  // is still handled correctly instead of getting a raw 500 from the
  // database's unique constraint. The key deliberately includes the
  // measured value, not just area/item/month/rep: many real source files
  // have finer granularity than one row per area/item/month (one row per
  // invoice or per branch, say), so several legitimately distinct rows
  // can share the same area/item/month with different values — that is
  // normal data the report already sums correctly, never dropped here.
  //
  // This is unrelated to — and never touches — a NEW upload colliding
  // with rows already committed from an EARLIER upload; that's still a
  // real "did you mean to replace this month" question, caught by the
  // POSTGRES_UNIQUE_VIOLATION handling below and the overlap/replace
  // prompt the client shows before ever calling this route.
  const { kept, removed: batchDuplicatesRemoved } = dedupeExactDuplicates(
    records,
    (r) => `${r.dataset_id}|${r.year}|${r.month}|${r.area}|${r.item}|${r.rep ?? ""}|${r.sales_value}|${r.sales_qty ?? ""}`,
    (r) => `${r.area} / ${r.item} / month ${r.month}`,
  );

  const { error } = await supabase.from("lumen_sales_records").insert(kept);

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      return NextResponse.json(
        {
          error:
            "Some of these rows are identical, in every column, to rows already in this dataset. " +
            "If you're correcting a month you already uploaded, use the overlap/replace prompt instead of adding to it.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // One combined log entry for every duplicate dropped on this upload —
  // whatever the client found across the whole file (pre-batching, sent
  // once on the first batch) plus anything this one batch found on its
  // own defensive pass — so there's still a visible record of the
  // removal even though nobody had to make a decision about it. Note
  // clientDuplicatesRemoved reflects the WHOLE file (computed before
  // batching) while batchDuplicatesRemoved is scoped to just this batch's
  // rows — kept.length is this batch only, so it's never combined with
  // either count into a single "total rows" figure below.
  const totalRemoved = (clientDuplicatesRemoved?.count ?? 0) + batchDuplicatesRemoved.count;
  if (totalRemoved > 0) {
    const examples = [...(clientDuplicatesRemoved?.examples ?? []), ...batchDuplicatesRemoved.examples].slice(0, 5);
    await supabase.from("lumen_data_edits").insert({
      dataset_id: datasetId,
      target_label: `Upload: ${totalRemoved} duplicate row(s) removed automatically${sourceFile ? ` (${sourceFile})` : ""}`,
      old_value: `${totalRemoved} duplicate row(s) found`,
      new_value: `kept one copy of each — e.g. ${examples.join("; ") || "an identical repeated row"}`,
      edited_by: user.email ?? user.id,
      is_undo: false,
    });
  }

  return NextResponse.json({ inserted: kept.length });
}
