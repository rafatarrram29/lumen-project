import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ColumnMapping, TargetColumnMapping } from "@/lib/lumen/columnMapping";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("lumen_datasets")
    .select("id, name, column_mapping, target_column_mapping, created_at, user_id")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    datasets: (data ?? []).map((d) => ({
      id: d.id as string,
      name: d.name as string,
      columnMapping: d.column_mapping as ColumnMapping,
      targetColumnMapping: d.target_column_mapping as TargetColumnMapping | null,
      createdAt: d.created_at as string,
      userId: d.user_id as string | null,
    })),
  });
}

export function isValidMapping(m: unknown): m is ColumnMapping {
  if (!m || typeof m !== "object") return false;
  const mapping = m as Record<string, unknown>;

  const requiredStrings: (keyof ColumnMapping)[] = ["area", "item", "value", "month"];
  for (const key of requiredStrings) {
    if (typeof mapping[key] !== "string" || (mapping[key] as string).trim() === "") return false;
  }

  const optional: (keyof ColumnMapping)[] = ["qty", "rep", "cluster"];
  for (const key of optional) {
    if (mapping[key] !== null && typeof mapping[key] !== "string") return false;
  }

  return true;
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
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
  const columnMapping = body?.columnMapping;

  if (!name) {
    return NextResponse.json({ error: "Dataset name is required" }, { status: 400 });
  }
  if (!isValidMapping(columnMapping)) {
    return NextResponse.json({ error: "Invalid column mapping" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lumen_datasets")
    .insert({ name, column_mapping: columnMapping, user_id: user.id })
    .select("id, name, column_mapping, target_column_mapping, created_at, user_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    dataset: {
      id: data.id as string,
      name: data.name as string,
      columnMapping: data.column_mapping as ColumnMapping,
      targetColumnMapping: data.target_column_mapping as TargetColumnMapping | null,
      createdAt: data.created_at as string,
      userId: data.user_id as string | null,
    },
  });
}
