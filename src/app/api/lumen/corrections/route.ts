import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_TYPES = ["wrong_number", "wrong_link", "bad_decision", "other"];

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
    .from("lumen_corrections")
    .select("id, issue_type, target_label, comment, status, created_at, resolved_at")
    .eq("dataset_id", datasetId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    corrections: (data ?? []).map((c) => ({
      id: c.id as string,
      issueType: c.issue_type as string,
      targetLabel: c.target_label as string | null,
      comment: c.comment as string,
      status: c.status as "open" | "resolved",
      createdAt: c.created_at as string,
      resolvedAt: c.resolved_at as string | null,
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
  const issueType = body?.issueType;
  const targetLabel = typeof body?.targetLabel === "string" ? body.targetLabel.slice(0, 200) : null;
  const comment = typeof body?.comment === "string" ? body.comment.trim().slice(0, 2000) : "";

  if (!datasetId) return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
  if (!VALID_TYPES.includes(issueType)) return NextResponse.json({ error: "Invalid issueType" }, { status: 400 });
  if (!comment) return NextResponse.json({ error: "Comment is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("lumen_corrections")
    .insert({ dataset_id: datasetId, issue_type: issueType, target_label: targetLabel, comment })
    .select("id, issue_type, target_label, comment, status, created_at, resolved_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    correction: {
      id: data.id as string,
      issueType: data.issue_type as string,
      targetLabel: data.target_label as string | null,
      comment: data.comment as string,
      status: data.status as "open" | "resolved",
      createdAt: data.created_at as string,
      resolvedAt: data.resolved_at as string | null,
    },
  });
}
