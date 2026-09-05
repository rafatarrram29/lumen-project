import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Report } from "@/lib/lumen/engine";
import { loadReport, latestYearWithData, type EditedCell } from "@/lib/lumen/loadReport";
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

  const initialDatasetId = datasets[0]?.id ?? null;

  let year = new Date().getFullYear();
  let initialReport: Report = { error: "No datasets yet — upload a file to get started." };
  let initialEditedCells: EditedCell[] = [];

  if (initialDatasetId) {
    year = await latestYearWithData(supabase, initialDatasetId);

    // The exact code path /api/lumen/analyze uses, so the first paint and
    // every refresh after it agree — including which figures are marked as
    // manually corrected, which the first paint used to leave out.
    const { payload, error } = await loadReport(supabase, initialDatasetId, year);

    if (payload) {
      const { editedCells, ...report } = payload;
      initialReport = report;
      initialEditedCells = editedCells;
    } else {
      initialReport = { error: error ?? "Could not build the report" };
    }
  }

  return (
    <LumenClient
      userEmail={user.email ?? ""}
      userId={user.id}
      initialYear={year}
      initialDatasets={datasets}
      initialDatasetId={initialDatasetId}
      initialReport={initialReport}
      initialEditedCells={initialEditedCells}
    />
  );
}
