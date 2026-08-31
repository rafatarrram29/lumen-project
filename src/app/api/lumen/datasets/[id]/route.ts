import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Deletes a dataset. lumen_sales_records.dataset_id has ON DELETE CASCADE
// (see supabase/lumen_datasets_migration.sql), so this also removes every
// row that was uploaded into it — deleting a dataset is permanent.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing dataset id" }, { status: 400 });
  }

  const { error } = await supabase.from("lumen_datasets").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
