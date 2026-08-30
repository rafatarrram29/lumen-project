import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_ROWS_PER_REQUEST = 5000;

type IncomingRow = {
  area: string;
  item: string;
  family: string;
  salesQty: number | null;
  salesValue: number;
  month: number;
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
  const sourceFile = typeof body?.sourceFile === "string" ? body.sourceFile.slice(0, 300) : null;
  const rows: IncomingRow[] = Array.isArray(body?.rows) ? body.rows : [];

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
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
    }));

  if (records.length === 0) {
    return NextResponse.json({ error: "No valid rows in payload" }, { status: 400 });
  }

  const { error } = await supabase.from("lumen_sales_records").insert(records);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: records.length });
}
