import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildReport, type Report, type SalesRecord } from "@/lib/lumen/engine";
import { fetchAllRows } from "@/lib/lumen/fetchAllRows";
import type { ColumnMapping, Dataset } from "@/lib/lumen/columnMapping";
import LumenClient from "./LumenClient";

export default async function LumenPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: datasetRows } = await supabase
    .from("lumen_datasets")
    .select("id, name, column_mapping, created_at, user_id")
    .order("created_at", { ascending: false });

  const datasets: Dataset[] = (datasetRows ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    columnMapping: d.column_mapping as ColumnMapping,
    createdAt: d.created_at as string,
    userId: d.user_id as string | null,
  }));

  const year = new Date().getFullYear();
  const initialDatasetId = datasets[0]?.id ?? null;

  let initialReport: Report = { error: "No datasets yet — upload a file to get started." };

  if (initialDatasetId) {
    const { data } = await fetchAllRows((from, to) =>
      supabase
        .from("lumen_sales_records")
        .select("area, family, sales_value, sales_qty, month, cluster, rep")
        .eq("year", year)
        .eq("dataset_id", initialDatasetId)
        .range(from, to),
    );

    const records: SalesRecord[] = (data ?? []).map((r) => ({
      area: r.area as string,
      family: r.family as string,
      salesValue: Number(r.sales_value),
      salesQty: r.sales_qty !== null ? Number(r.sales_qty) : null,
      month: Number(r.month),
      cluster: r.cluster as string | null,
      rep: r.rep as string | null,
    }));

    initialReport = buildReport(records, year);
  }

  return (
    <LumenClient
      userEmail={user.email ?? ""}
      userId={user.id}
      initialYear={year}
      initialDatasets={datasets}
      initialDatasetId={initialDatasetId}
      initialReport={initialReport}
    />
  );
}
