import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidImsMapping, type ImsColumnMapping } from "@/lib/lumen/imsMapping";

function isValidMapping(m: unknown): m is ImsColumnMapping {
  if (!m || typeof m !== "object") return false;
  const mapping = m as Record<string, unknown>;
  for (const key of ["area", "product", "month", "company", "fixedProduct"]) {
    if (mapping[key] !== null && typeof mapping[key] !== "string") return false;
  }
  if (typeof mapping.marketShare !== "string" || mapping.marketShare.trim() === "") return false;
  if (mapping.fixedMonth !== null && typeof mapping.fixedMonth !== "number") return false;
  return isValidImsMapping(mapping as unknown as ImsColumnMapping);
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
    .from("lumen_ims_files")
    .select("id, display_name, column_mapping, own_company, created_at")
    .eq("dataset_id", datasetId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    files: (data ?? []).map((f) => ({
      id: f.id as string,
      displayName: f.display_name as string,
      columnMapping: f.column_mapping as ImsColumnMapping,
      ownCompany: f.own_company as string | null,
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
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 200) : "";
  const sourceFile = typeof body?.sourceFile === "string" ? body.sourceFile.slice(0, 300) : null;
  const columnMapping = body?.columnMapping;
  const ownCompany = typeof body?.ownCompany === "string" ? body.ownCompany.trim().slice(0, 200) : null;

  if (!datasetId) return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  if (!displayName) return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  if (!isValidMapping(columnMapping)) return NextResponse.json({ error: "Invalid column mapping" }, { status: 400 });

  const { data: fileRow, error } = await supabase
    .from("lumen_ims_files")
    .insert({
      dataset_id: datasetId,
      display_name: displayName,
      source_file: sourceFile,
      column_mapping: columnMapping,
      own_company: ownCompany,
    })
    .select("id, display_name, column_mapping, own_company, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    file: {
      id: fileRow.id as string,
      displayName: fileRow.display_name as string,
      columnMapping: fileRow.column_mapping as ImsColumnMapping,
      ownCompany: fileRow.own_company as string | null,
      createdAt: fileRow.created_at as string,
    },
  });
}
