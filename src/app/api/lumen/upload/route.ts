import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findDuplicateKeys, POSTGRES_UNIQUE_VIOLATION } from "@/lib/lumen/duplicateCheck";

const MAX_ROWS_PER_REQUEST = 5000;

type IncomingRow = {
  area: string;
  item: string;
  family: string;
  salesQty: number | null;
  salesValue: number;
  month: number;
  rep: string | null;
  cluster: string | null;
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
      cluster: typeof r.cluster === "string" ? r.cluster : null,
    }));

  if (records.length === 0) {
    return NextResponse.json({ error: "No valid rows in payload" }, { status: 400 });
  }

  // Reject a batch that duplicates area/item/month(/rep) within itself
  // BEFORE attempting to insert it — this is the actual mechanism that
  // silently inflated real data in the past, since nothing previously
  // stopped two rows for the same area+item+month from both being
  // inserted.
  const duplicates = findDuplicateKeys(
    records,
    (r) => `${r.dataset_id}|${r.year}|${r.month}|${r.area}|${r.item}|${r.rep ?? ""}`,
  );
  if (duplicates.length > 0) {
    const [area, item, month, rep] = duplicates[0].key.split("|").slice(3);
    const example = rep ? `${area} / ${item} / month ${month} / rep ${rep}` : `${area} / ${item} / month ${month}`;
    return NextResponse.json(
      {
        error:
          `This batch has ${duplicates.length} area/item/month combination(s) repeated more than once ` +
          `(e.g. ${example}) — check the source file for repeated rows, or if this is a re-upload of a ` +
          `month you already have, use the overlap/replace prompt instead of adding to the dataset.`,
      },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("lumen_sales_records").insert(records);

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      return NextResponse.json(
        {
          error:
            "Some of these rows duplicate data already in this dataset for the same area/item/month(/rep). " +
            "If you're correcting a month you already uploaded, use the overlap/replace prompt instead of adding to it.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: records.length });
}
