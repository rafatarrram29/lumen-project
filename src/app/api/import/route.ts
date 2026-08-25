import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, isCategoryId, requiredFields, type FieldType } from "@/lib/categories";

const MAX_ROWS = 5000;
const UPSERT_CHUNK_SIZE = 500;

function normalizeValue(type: FieldType, raw: unknown): string | number | null {
  if (type === "number") {
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
    if (typeof raw === "string") {
      const cleaned = raw.replace(/[,%\s]/g, "");
      if (cleaned === "") return null;
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
  if (raw === null || raw === undefined) return "";
  return String(raw).trim();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const fileName = typeof body?.fileName === "string" ? body.fileName.slice(0, 200) : "upload";
  const categoryRaw = typeof body?.category === "string" ? body.category : "";
  const columnMapping =
    body?.columnMapping && typeof body.columnMapping === "object"
      ? (body.columnMapping as Record<string, string | null>)
      : {};
  const rows = Array.isArray(body?.rows) ? (body.rows as Record<string, unknown>[]).slice(0, MAX_ROWS) : [];
  const aiConfidence = typeof body?.aiConfidence === "number" ? body.aiConfidence : null;
  const aiReasoning = typeof body?.aiReasoning === "string" ? body.aiReasoning : null;

  if (!isCategoryId(categoryRaw)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }

  const def = CATEGORIES[categoryRaw];
  const missingMapping = requiredFields(categoryRaw).filter((f) => !columnMapping[f.key]);
  if (missingMapping.length > 0) {
    return NextResponse.json(
      { error: `Missing column mapping for required field(s): ${missingMapping.map((f) => f.label).join(", ")}` },
      { status: 400 },
    );
  }

  const { data: upload, error: uploadError } = await supabase
    .from("uploads")
    .insert({
      user_id: user.id,
      file_name: fileName,
      category: categoryRaw,
      status: "confirmed",
      ai_confidence: aiConfidence,
      ai_reasoning: aiReasoning,
      column_mapping: columnMapping,
      row_count: rows.length,
    })
    .select("id")
    .single();

  if (uploadError || !upload) {
    return NextResponse.json({ error: uploadError?.message ?? "Failed to log upload" }, { status: 500 });
  }

  const records: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const row of rows) {
    const record: Record<string, unknown> = { upload_id: upload.id, created_by: user.id };
    let missingRequired = false;

    for (const field of def.fields) {
      const sourceCol = columnMapping[field.key];
      const raw = sourceCol ? row[sourceCol] : undefined;
      const value = normalizeValue(field.type, raw);
      record[field.key] = value;
      if (field.required && (value === "" || value === null)) {
        missingRequired = true;
      }
    }

    if (missingRequired) {
      skipped += 1;
      continue;
    }
    records.push(record);
  }

  if (records.length === 0) {
    return NextResponse.json(
      { error: "Every row was missing a required field after mapping -- nothing was imported." },
      { status: 400 },
    );
  }

  for (let i = 0; i < records.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = records.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await supabase.from(def.table).upsert(chunk, { onConflict: def.uniqueKey.join(",") });
    if (error) {
      return NextResponse.json(
        { error: `Imported ${i} of ${records.length} rows, then failed: ${error.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    category: categoryRaw,
    imported: records.length,
    skipped,
    uploadId: upload.id,
  });
}
