import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildReport, type Report, type SalesRecord, type TargetRecord } from "@/lib/lumen/engine";
import { fetchAllRows } from "@/lib/lumen/fetchAllRows";
import type { ColumnMapping, Dataset, TargetColumnMapping } from "@/lib/lumen/columnMapping";
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
    .select("id, name, column_mapping, target_column_mapping, created_at, user_id")
    .order("created_at", { ascending: false });

  const datasets: Dataset[] = (datasetRows ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    columnMapping: d.column_mapping as ColumnMapping,
    targetColumnMapping: d.target_column_mapping as TargetColumnMapping | null,
    createdAt: d.created_at as string,
    userId: d.user_id as string | null,
  }));

  const year = new Date().getFullYear();
  const initialDatasetId = datasets[0]?.id ?? null;

  let initialReport: Report = { error: "No datasets yet — upload a file to get started." };

  if (initialDatasetId) {
    // Neither query depends on the other's result — fetching them
    // concurrently instead of one after another roughly halves this
    // part of the page's server-side latency.
    const [{ data }, { data: targetData }] = await Promise.all([
      fetchAllRows((from, to) =>
        supabase
          .from("lumen_sales_records")
          .select("area, family, sales_value, sales_qty, month, cluster, rep")
          .eq("year", year)
          .eq("dataset_id", initialDatasetId)
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        supabase
          .from("lumen_targets")
          .select("area, rep, item, month, target_value")
          .eq("year", year)
          .eq("dataset_id", initialDatasetId)
          .range(from, to),
      ),
    ]);

    const records: SalesRecord[] = (data ?? []).map((r) => ({
      area: r.area as string,
      family: r.family as string,
      salesValue: Number(r.sales_value),
      salesQty: r.sales_qty !== null ? Number(r.sales_qty) : null,
      month: Number(r.month),
      cluster: r.cluster as string | null,
      rep: r.rep as string | null,
    }));

    const targets: TargetRecord[] = (targetData ?? []).map((t) => ({
      area: t.area as string | null,
      rep: t.rep as string | null,
      item: t.item as string | null,
      month: Number(t.month),
      targetValue: Number(t.target_value),
    }));

    initialReport = buildReport(records, year, targets);
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
