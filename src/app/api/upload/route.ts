import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_ROWS = 5000;
const MAX_COLUMNS = 100;

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.name !== "string" ||
    !Array.isArray(body.columns) ||
    !Array.isArray(body.rows)
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const name = body.name.slice(0, 200);
  const columns = body.columns.slice(0, MAX_COLUMNS);
  const rows = body.rows.slice(0, MAX_ROWS);

  if (columns.length === 0 || rows.length === 0) {
    return NextResponse.json(
      { error: "File has no usable data" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("datasets")
    .insert({
      user_id: user.id,
      name,
      columns,
      rows,
      row_count: rows.length,
    })
    .select("id, name, row_count, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dataset: data });
}
