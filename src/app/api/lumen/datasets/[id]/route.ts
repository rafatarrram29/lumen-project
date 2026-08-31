import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Deletes a dataset. lumen_sales_records.dataset_id has ON DELETE CASCADE
// (see supabase/lumen_datasets_migration.sql), so this also removes every
// row that was uploaded into it — deleting a dataset is permanent. RLS
// (see supabase/lumen_user_isolation_migration.sql) only lets this match
// a dataset the caller owns, so a delete for someone else's (or a shared
// legacy) dataset silently matches zero rows rather than erroring — that's
// reported back as a 404 instead of a false "success".
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

  const { error, count } = await supabase
    .from("lumen_datasets")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json(
      { error: "Dataset not found, or you don't have permission to delete it" },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true });
}
