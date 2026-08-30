import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildReport, type SalesRecord } from "@/lib/lumen/engine";
import LumenClient from "./LumenClient";

export default async function LumenPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const year = new Date().getFullYear();
  const { data } = await supabase
    .from("lumen_sales_records")
    .select("area, family, sales_value, sales_qty, month")
    .eq("year", year);

  const records: SalesRecord[] = (data ?? []).map((r) => ({
    area: r.area as string,
    family: r.family as string,
    salesValue: Number(r.sales_value),
    salesQty: r.sales_qty !== null ? Number(r.sales_qty) : null,
    month: Number(r.month),
  }));

  return (
    <LumenClient
      userEmail={user.email ?? ""}
      initialYear={year}
      initialReport={buildReport(records, year)}
    />
  );
}
