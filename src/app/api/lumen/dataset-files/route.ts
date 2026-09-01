import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { JoinKey, LinkedFileMapping, LinkedFileType } from "@/lib/lumen/linkedFiles";

const VALID_TYPES: LinkedFileType[] = ["achievement", "kpis", "other"];
const VALID_KEYS: JoinKey[] = ["area", "rep", "cluster", "month"];

function isValidMapping(m: unknown): m is LinkedFileMapping {
  if (!m || typeof m !== "object") return false;
  const mapping = m as Record<string, unknown>;
  if (typeof mapping.month !== "string" || mapping.month.trim() === "") return false;
  for (const key of ["area", "rep", "cluster"]) {
    if (mapping[key] !== null && typeof mapping[key] !== "string") return false;
  }
  return true;
}

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get("datasetId");
  if (!datasetId) {
    return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lumen_dataset_files")
    .select("id, file_type, display_name, column_mapping, join_keys, created_at")
    .eq("dataset_id", datasetId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    files: (data ?? []).map((f) => ({
      id: f.id as string,
      fileType: f.file_type as LinkedFileType,
      displayName: f.display_name as string,
      columnMapping: f.column_mapping as LinkedFileMapping,
      joinKeys: f.join_keys as JoinKey[],
      createdAt: f.created_at as string,
    })),
  });
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
  const datasetId = typeof body?.datasetId === "string" ? body.datasetId : null;
  const fileType = body?.fileType;
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 200) : "";
  const sourceFile = typeof body?.sourceFile === "string" ? body.sourceFile.slice(0, 300) : null;
  const columnMapping = body?.columnMapping;
  const joinKeys: unknown = body?.joinKeys;

  if (!datasetId) return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  if (!VALID_TYPES.includes(fileType)) return NextResponse.json({ error: "Invalid fileType" }, { status: 400 });
  if (!displayName) return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  if (!isValidMapping(columnMapping)) return NextResponse.json({ error: "Invalid column mapping" }, { status: 400 });
  if (!Array.isArray(joinKeys) || joinKeys.length === 0 || !joinKeys.every((k) => VALID_KEYS.includes(k))) {
    return NextResponse.json({ error: "Invalid join keys" }, { status: 400 });
  }

  const { data: fileRow, error } = await supabase
    .from("lumen_dataset_files")
    .insert({
      dataset_id: datasetId,
      file_type: fileType,
      display_name: displayName,
      source_file: sourceFile,
      column_mapping: columnMapping,
      join_keys: joinKeys,
    })
    .select("id, file_type, display_name, column_mapping, join_keys, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    file: {
      id: fileRow.id as string,
      fileType: fileRow.file_type as LinkedFileType,
      displayName: fileRow.display_name as string,
      columnMapping: fileRow.column_mapping as LinkedFileMapping,
      joinKeys: fileRow.join_keys as JoinKey[],
      createdAt: fileRow.created_at as string,
    },
  });
}
