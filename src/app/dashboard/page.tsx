import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: datasets } = await supabase
    .from("datasets")
    .select("id, name, row_count, created_at")
    .order("created_at", { ascending: false });

  return (
    <DashboardClient
      userEmail={user.email ?? ""}
      initialDatasets={datasets ?? []}
    />
  );
}
