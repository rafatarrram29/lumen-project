import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";
import { dedupeExactDuplicates, findDuplicateKeys, POSTGRES_UNIQUE_VIOLATION } from "@/lib/lumen/duplicateCheck";

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
  // Present only when the upload's mapping included a real per-row
  // identifier (Customer ID, invoice number, ...) — never persisted, used
  // only to make the duplicate-check key below actually trustworthy.
  uniqueId?: string | null;
};

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;
  const sourceFile = typeof body?.sourceFile === "string" ? body.sourceFile.slice(0, 300) : null;
  const rows: IncomingRow[] = Array.isArray(body?.rows) ? body.rows : [];
  // Whether the upload's mapping included a real per-row identifier —
  // decides which duplicate-check mode below is actually safe to run.
  const hasUniqueId = body?.hasUniqueId === true;
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
      // Carried only for the duplicate-check key below — lumen_sales_records
      // has no such column, so this is stripped before the actual insert.
      unique_id: typeof r.uniqueId === "string" ? r.uniqueId : null,
    }));

  if (records.length === 0) {
    return NextResponse.json({ error: "No valid rows in payload" }, { status: 400 });
  }

  // An exact full duplicate row within this SAME batch is only safe to
  // auto-remove when it's keyed on a real per-row identifier (Customer ID,
  // invoice number, ...) as well as area/item/month/rep/value/qty —
  // without one, two DIFFERENT customers who happen to order the same
  // quantity at the same list price would look identical on every column
  // this app tracks, and are NOT duplicates (this was measured to
  // silently remove 68-75% of two real multi-customer sales files' rows
  // when tried on the weaker key alone). With hasUniqueId, this is mostly
  // a defensive backstop — the client already dedupes the whole file with
  // the same strong key before splitting it into batches — for any caller
  // that doesn't pre-dedupe. Without one, this keeps the original
  // behavior: reject the batch and ask the uploader to look at it, via
  // the same 409 the database's own unique constraint produces below for
  // a cross-upload collision.
  //
  // Either way this is unrelated to — and never touches — a NEW upload
  // colliding with rows already committed from an EARLIER upload; that's
  // still a real "did you mean to replace this month" question, caught by
  // the POSTGRES_UNIQUE_VIOLATION handling below and the overlap/replace
  // prompt the client shows before ever calling this route.
  const keyFn = (r: (typeof records)[number]) =>
    hasUniqueId
      ? `${r.dataset_id}|${r.year}|${r.month}|${r.area}|${r.item}|${r.rep ?? ""}|${r.sales_value}|${r.sales_qty ?? ""}|${r.unique_id ?? ""}`
      : `${r.dataset_id}|${r.year}|${r.month}|${r.area}|${r.item}|${r.rep ?? ""}|${r.sales_value}|${r.sales_qty ?? ""}`;

  let kept = records;
  let batchDuplicatesRemoved = { count: 0, examples: [] as string[] };
  if (hasUniqueId) {
    const result = dedupeExactDuplicates(records, keyFn, (r) => `${r.area} / ${r.item} / month ${r.month}`);
    kept = result.kept;
    batchDuplicatesRemoved = result.removed;
  } else {
    const duplicates = findDuplicateKeys(records, keyFn);
    if (duplicates.length > 0) {
      const parts = duplicates[0].key.split("|");
      const [, , month, area, item, rep] = parts;
      const example = rep ? `${area} / ${item} / month ${month} / rep ${rep}` : `${area} / ${item} / month ${month}`;
      return NextResponse.json(
        {
          error:
            `This batch has ${duplicates.length} row(s) repeated more than once, identical in every column ` +
            `(e.g. ${example}) — check the source file for an accidentally repeated row, map a Customer ID or ` +
            `invoice number column to have exact repeats removed automatically, or if this is a re-upload of a ` +
            `month you already have, use the overlap/replace prompt instead of adding to the dataset.`,
        },
        { status: 409 },
      );
    }
  }

  const { error } = await supabase.from("lumen_sales_records").insert(
    kept.map((r) => ({
      area: r.area,
      item: r.item,
      family: r.family,
      sales_qty: r.sales_qty,
      sales_value: r.sales_value,
      month: r.month,
      year: r.year,
      uploaded_at: r.uploaded_at,
      source_file: r.source_file,
      dataset_id: r.dataset_id,
      rep: r.rep,
      line: r.line,
    })),
  );

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
