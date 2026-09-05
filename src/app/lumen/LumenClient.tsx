"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  applyColumnMapping,
  applyTargetMapping,
  type ColumnMapping,
  type Dataset,
  type RawSheet,
  type TargetColumnMapping,
} from "@/lib/lumen/columnMapping";
import type { Finding, Report } from "@/lib/lumen/engine";
import type { EditedCell } from "@/lib/lumen/loadReport";
import { StatTile, AreaChangeBars, FamilyChangeBars, RepLeaderboard } from "./charts";
import { colorForFamily } from "@/lib/lumen/familyColors";
import Sidebar from "@/components/Sidebar";
import { UploadWizardModal, type WizardChoice } from "./UploadWizardModal";
import { UploadTargetsModal } from "./UploadTargetsModal";
import { RepHistoryPanel } from "./RepHistoryPanel";
import { repResponsibleInMonth } from "@/lib/lumen/repAssignments";
import { buildOrgChart, knownReps, managerForRep } from "@/lib/lumen/orgStructure";
import { AssignAreasModal } from "./AssignAreasModal";
import { AssignManagersModal } from "./AssignManagersModal";
import { ManagerCards } from "./ManagerCards";
import { LinkedFilesPanel } from "./LinkedFilesPanel";
import { AddLinkedFileModal } from "./AddLinkedFileModal";
import { recordsForAreaMonth } from "@/lib/lumen/linkedFiles";
import { CorrectionLogModal } from "./CorrectionLogModal";
import { EditSalesMappingModal } from "./EditSalesMappingModal";
import { EditableValue, EditableFieldValue } from "./EditableValue";
import { UndoToast } from "./UndoToast";
import { ExportModal, type ExportFormat } from "./ExportModal";
import { buildExportItems } from "@/lib/lumen/exportItems";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { findingSummary, findingDecision } from "@/lib/i18n/findingText";
import type { Translations } from "@/lib/i18n/translations";
import { AddImsFileModal } from "./AddImsFileModal";
import { dedupeExactDuplicates } from "@/lib/lumen/duplicateCheck";
import { imsGroupLabel } from "@/lib/lumen/imsLabels";
import { GlobalSearch } from "./GlobalSearch";
import { useLumenData } from "./useLumenData";
import { UPLOAD_BATCH_SIZE, UNDO_WINDOW_MS, type UploadStatus } from "./uploadShared";
import { useLinkedFileUploads } from "./useLinkedFileUploads";
import { useImsFileUploads } from "./useImsFileUploads";

// recharts is a heavy dependency only ever needed once a trend chart is
// actually shown (an area or item card expanded, or the Market Insights
// tab). Dynamic import keeps it out of the module graph the page evaluates
// on load.
const TrendChart = dynamic(() => import("./TrendChart").then((m) => m.TrendChart), { ssr: false });
const ItemTrendChart = dynamic(() => import("./ItemTrendChart").then((m) => m.ItemTrendChart), { ssr: false });
// ImsPanel was imported statically, which dragged ImsTrendChart and with it
// recharts into the eager bundle — quietly cancelling the two splits above.
const ImsPanel = dynamic(() => import("./ImsPanel").then((m) => m.ImsPanel), { ssr: false });

function areaCardId(area: string): string {
  return `area-card-${encodeURIComponent(area)}`;
}

function itemCardId(item: string): string {
  return `item-card-${encodeURIComponent(item)}`;
}

function repCardId(rep: string): string {
  return `rep-card-${encodeURIComponent(rep)}`;
}


type LastEdit =
  | { kind: "sales"; area: string; family: string; month: number; oldValue: number; newValue: number }
  | { kind: "linked"; recordId: string; key: string; oldValue: unknown; newValue: unknown }
  | { kind: "rename"; field: "area" | "item"; oldValue: string; newValue: string }
  | { kind: "imsRename"; field: "area" | "product" | "company"; oldValue: string; newValue: string };

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function Badge({ pctChange }: { pctChange: number | null }) {
  if (pctChange === null) {
    return (
      <span className="rounded-full border border-bdr px-2.5 py-1 font-mono text-xs text-muted">
        n/a
      </span>
    );
  }
  const positive = pctChange > 0;
  return (
    <span
      className={`rounded-full border px-2.5 py-1 font-mono text-xs font-bold ${
        positive ? "border-green/40 bg-green/20 text-green" : "border-red/40 bg-red/20 text-red"
      }`}
    >
      {positive ? "+" : ""}
      {pctChange}%
    </span>
  );
}

function TargetChip({
  progress,
  threshold,
  t,
}: {
  progress: { targetValue: number; pctOfTarget: number | null } | undefined;
  threshold: number;
  t: Translations;
}) {
  if (!progress || progress.pctOfTarget === null) return null;
  const under = progress.pctOfTarget < threshold;
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold ${
        under ? "border-red/40 bg-red/20 text-red" : "border-green/40 bg-green/20 text-green"
      }`}
      title={under ? t.targets.underTarget : undefined}
    >
      {t.targets.ofTarget(progress.pctOfTarget)}
    </span>
  );
}

export default function LumenClient({
  userEmail,
  userId,
  initialYear,
  initialDatasets,
  initialDatasetId,
  initialReport,
  initialEditedCells,
}: {
  userEmail: string;
  userId: string;
  initialYear: number;
  initialDatasets: Dataset[];
  initialDatasetId: string | null;
  initialReport: Report;
  initialEditedCells: EditedCell[];
}) {
  const { t, lang } = useLanguage();

  const [year, setYear] = useState(initialYear);
  const [datasets, setDatasets] = useState<Dataset[]>(initialDatasets);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(initialDatasetId);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [expandedReps, setExpandedReps] = useState<Set<string>>(new Set());
  const [pendingFiles, setPendingFiles] = useState<{ file: File; sheet: RawSheet }[]>([]);
  const [pendingTargetsFile, setPendingTargetsFile] = useState<File | null>(null);
  const [pendingTargetsSheet, setPendingTargetsSheet] = useState<RawSheet | null>(null);
  const [targetThreshold, setTargetThreshold] = useState(70);
  const [activeTab, setActiveTab] = useState<"sales" | "ims">("sales");
  const [showAssignAreas, setShowAssignAreas] = useState(false);
  const [showAssignManagers, setShowAssignManagers] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  // Set when global search jumps to a Market Insights group; used as the
  // panel's key so it opens on that group.
  const [imsFocusGroup, setImsFocusGroup] = useState<string | null>(null);
  const [showCorrectionLog, setShowCorrectionLog] = useState(false);
  const [showEditSalesMapping, setShowEditSalesMapping] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastEdit, setLastEdit] = useState<LastEdit | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetsFileInputRef = useRef<HTMLInputElement>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Every read the dashboard performs lives in useLumenData — see the note
  // at the top of that file. What stays here is the state the user drives
  // directly (what is selected, expanded, being uploaded) and the mutations.
  const {
    report,
    setReport,
    loadingReport,
    editedCells,
    assignments,
    managerLinks,
    fetchManagerLinks,
    linkedFiles,
    linkedRecords,
    dataEdits,
    imsFiles,
    imsReport,
    imsLoading,
    fetchReport,
    fetchAssignments,
    fetchLinkedFiles,
    fetchLinkedRecords,
    fetchDataEdits,
    loadImsData,
    ensureImsLoaded,
  } = useLumenData({
    initialReport,
    initialEditedCells,
    initialDatasetId,
    initialYear,
    selectedDatasetId,
    year,
    activeTab,
    couldNotLoadMessage: t.dashboard.couldNotLoad,
  });

  function clearUndo() {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = null;
    setLastEdit(null);
  }

  function armUndo(edit: LastEdit) {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setLastEdit(edit);
    undoTimeoutRef.current = setTimeout(() => setLastEdit(null), UNDO_WINDOW_MS);
  }

  // The four setters behind the one upload status bar, handed to each
  // upload flow as a unit rather than as four loose arguments.
  const uploadStatus: UploadStatus = {
    setUploading,
    setProgress: setUploadProgress,
    setError: setUploadError,
    setMessage: setUploadMessage,
  };

  const {
    pendingLinkedFile,
    setPendingLinkedFile,
    replacingLinkedFileId,
    setReplacingLinkedFileId,
    handleAddLinkedFile,
    handleReplaceLinkedFile,
    handleLinkedFileConfirm,
    handleDeleteLinkedFile,
    handleEditJoinKeys,
  } = useLinkedFileUploads({
    datasetId: selectedDatasetId,
    year,
    t,
    status: uploadStatus,
    fetchLinkedFiles,
    fetchLinkedRecords,
    fetchDataEdits,
  });

  const {
    pendingImsFile,
    setPendingImsFile,
    handleAddImsFile,
    handleImsFileConfirm,
    handleDeleteImsFile,
    handleRenameImsField,
  } = useImsFileUploads({
    datasetId: selectedDatasetId,
    year,
    t,
    status: uploadStatus,
    loadImsData,
    fetchDataEdits,
    armUndo,
  });

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);


  async function handleAssignAreas(rep: string, areasToAssign: string[], startMonth: number, endMonth: number) {
    if (!selectedDatasetId) return;
    setSavingOrg(true);
    setUploadError(null);
    try {
      const res = await fetch("/api/lumen/rep-assignments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: selectedDatasetId, year, rep, areas: areasToAssign, startMonth, endMonth }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not assign the areas");
      setUploadMessage(t.org.assignedAreas(areasToAssign.length, rep));
      setShowAssignAreas(false);
      await fetchAssignments(selectedDatasetId, year);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not assign the areas");
    } finally {
      setSavingOrg(false);
    }
  }

  async function handleAssignManager(manager: string, repsToAssign: string[]) {
    if (!selectedDatasetId) return;
    setSavingOrg(true);
    setUploadError(null);
    try {
      const res = await fetch("/api/lumen/district-managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: selectedDatasetId, year, manager, reps: repsToAssign }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not assign the reps");
      setUploadMessage(t.org.assignedReps(repsToAssign.length, manager));
      setShowAssignManagers(false);
      await fetchManagerLinks(selectedDatasetId, year);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not assign the reps");
    } finally {
      setSavingOrg(false);
    }
  }

  function selectDataset(datasetId: string) {
    setSelectedDatasetId(datasetId);
    setExpanded(new Set());
    clearUndo();
    fetchReport(datasetId, year);
  }

  async function handleDeleteDataset(dataset: Dataset) {
    const proceed = window.confirm(t.dashboard.deleteDatasetConfirm(dataset.name));
    if (!proceed) return;

    setUploadError(null);
    try {
      const res = await fetch(`/api/lumen/datasets/${dataset.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not delete dataset");

      const remaining = datasets.filter((d) => d.id !== dataset.id);
      setDatasets(remaining);

      if (selectedDatasetId === dataset.id) {
        const next = remaining[0]?.id ?? null;
        setSelectedDatasetId(next);
        setExpanded(new Set());
        if (next) {
          await fetchReport(next, year);
        } else {
          setReport({ error: t.dashboard.noDatasets });
        }
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not delete dataset");
    }
  }

  async function handleFilesSelected(files: File[]) {
    setUploadError(null);
    setUploadMessage(null);
    const { readWorkbookSheet } = await import("@/lib/lumen/readWorkbookSheet");
    const read: { file: File; sheet: RawSheet }[] = [];
    const failed: string[] = [];
    for (const file of files) {
      try {
        const sheet = await readWorkbookSheet(file);
        read.push({ file, sheet });
      } catch (err) {
        failed.push(`${file.name}: ${err instanceof Error ? err.message : "Could not read that file."}`);
      }
    }
    if (read.length > 0) setPendingFiles(read);
    if (failed.length > 0) setUploadError(failed.join(" | "));
  }

  async function handleTargetsFileSelected(file: File) {
    setUploadError(null);
    setUploadMessage(null);
    try {
      const { readWorkbookSheet } = await import("@/lib/lumen/readWorkbookSheet");
      const sheet = await readWorkbookSheet(file);
      setPendingTargetsFile(file);
      setPendingTargetsSheet(sheet);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  async function handleTargetsConfirm(mapping: TargetColumnMapping) {
    const file = pendingTargetsFile;
    const sheet = pendingTargetsSheet;
    setPendingTargetsFile(null);
    setPendingTargetsSheet(null);
    if (!file || !sheet || !selectedDatasetId) return;

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    try {
      const { rows, skipped } = applyTargetMapping(sheet, mapping);

      const currentDataset = datasets.find((d) => d.id === selectedDatasetId);
      const mappingUnchanged =
        currentDataset?.targetColumnMapping &&
        currentDataset.targetColumnMapping.area === mapping.area &&
        currentDataset.targetColumnMapping.rep === mapping.rep &&
        currentDataset.targetColumnMapping.item === mapping.item &&
        currentDataset.targetColumnMapping.month === mapping.month &&
        currentDataset.targetColumnMapping.value === mapping.value;

      if (!mappingUnchanged) {
        const patchRes = await fetch(`/api/lumen/datasets/${selectedDatasetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetColumnMapping: mapping }),
        });
        if (patchRes.ok) {
          setDatasets((prev) =>
            prev.map((d) => (d.id === selectedDatasetId ? { ...d, targetColumnMapping: mapping } : d)),
          );
        }
      }

      const replaceRes = await fetch("/api/lumen/targets/replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, datasetId: selectedDatasetId }),
      });
      const replaceJson = await replaceRes.json();
      if (!replaceRes.ok) throw new Error(replaceJson.error || "Could not clear existing targets");

      const batches = [];
      for (let i = 0; i < rows.length; i += UPLOAD_BATCH_SIZE) {
        batches.push(rows.slice(i, i + UPLOAD_BATCH_SIZE));
      }

      let inserted = 0;
      for (let i = 0; i < batches.length; i++) {
        setUploadProgress(`Uploading batch ${i + 1} of ${batches.length}…`);
        const res = await fetch("/api/lumen/targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year, datasetId: selectedDatasetId, rows: batches[i] }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Targets upload failed");
        inserted += json.inserted;
      }

      setUploadMessage(t.targets.uploadSuccess(inserted));
      if (skipped.count > 0) {
        setUploadError(
          `Skipped ${skipped.count} row(s) that couldn't be read (${skipped.examples.join("; ") || "missing month/value"}) — check the source file for those rows.`,
        );
      }
      await fetchReport(selectedDatasetId, year);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Targets upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function uploadRowsToDataset(
    datasetId: string,
    mapping: ColumnMapping,
    sheet: RawSheet,
    fileName: string,
    fileLabel: string,
  ): Promise<{ inserted: number; warning?: string } | false> {
    const { rows: parsedRows, skipped } = applyColumnMapping(sheet, mapping);
    // An exact repeat of a row within this same file (every TRACKED column
    // identical, including the value) can only be safely auto-removed when
    // the mapping includes a real per-row identifier (Customer ID, invoice
    // number, ...): without one, two DIFFERENT customers who happen to
    // order the same quantity at the same price look byte-identical to
    // everything this app tracks, and are NOT duplicates — auto-deleting
    // on that weaker key was measured to silently remove 68-75% of two
    // real multi-customer sales files' rows. With a uniqueId mapped, the
    // key can tell the two cases apart and it's safe to drop and continue;
    // without one, this falls back to the original behavior further down
    // (the server rejects the batch and asks the uploader to look at it).
    // Either way this is scoped to THIS one file/upload attempt only — a
    // new upload colliding with rows already committed from an earlier
    // upload is a different case, still handled by the overlap/replace
    // prompt above and the database's own uniqueness constraint.
    const dedupeResult = mapping.uniqueId
      ? dedupeExactDuplicates(
          parsedRows,
          (r) => `${r.month}|${r.area}|${r.item}|${r.rep ?? ""}|${r.salesValue}|${r.salesQty ?? ""}|${r.uniqueId ?? ""}`,
          (r) => `${r.area} / ${r.item} / month ${r.month}`,
        )
      : { kept: parsedRows, removed: { count: 0, examples: [] as string[] } };
    const rows = dedupeResult.kept;
    const duplicatesRemoved = dedupeResult.removed;
    const monthsInFile = Array.from(new Set(rows.map((r) => r.month))).sort((a, b) => a - b);
    const areasInFile = Array.from(new Set(rows.map((r) => r.area)));

    const overlapRes = await fetch("/api/lumen/check-overlap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, datasetId, months: monthsInFile, areas: areasInFile }),
    });
    const overlapJson = await overlapRes.json();
    if (!overlapRes.ok) throw new Error(overlapJson.error || "Could not check for existing months");

    const overlappingMonths: number[] = overlapJson.overlappingMonths ?? [];
    if (overlappingMonths.length > 0) {
      const existingSourceFiles: string[] = overlapJson.existingSourceFiles ?? [];
      const existingFilesNote =
        existingSourceFiles.length > 0
          ? ` The data currently there came from: ${existingSourceFiles.join(", ")}.`
          : "";
      const proceed = window.confirm(
        `${fileLabel} — month(s) ${overlappingMonths.join(", ")} already have data in this dataset for ${year}.${existingFilesNote} ` +
          `Continuing will delete the existing rows for those months and replace them with ` +
          `this file. This cannot be undone. Continue?`,
      );
      if (!proceed) return false;

      // Replacing a month deletes EVERY area's rows for it, not just the
      // ones this file has. An area that currently has data for these
      // months but isn't in this file at all would lose that data
      // permanently with nothing to replace it — a second, more explicit
      // confirmation makes that impossible to blow through by accident
      // (this is the exact shape of mistake that produced a real
      // production data-loss incident: a smaller/test file silently
      // wiping out other areas' real numbers for the same month).
      const areasAtRisk: { area: string; rowCount: number; totalValue: number }[] = overlapJson.areasAtRisk ?? [];
      if (areasAtRisk.length > 0) {
        const list = areasAtRisk
          .map((a) => `${a.area} (${formatNumber(a.totalValue)} across ${a.rowCount} row(s))`)
          .join(", ");
        const proceedAnyway = window.confirm(
          `⚠️ WARNING — ${fileLabel} does NOT include these area(s), which currently have data for month(s) ` +
            `${overlappingMonths.join(", ")}: ${list}. ` +
            `Continuing will PERMANENTLY DELETE their data for these months, with nothing from this file to replace it. ` +
            `Only continue if you really mean to remove those areas' data for these months.`,
        );
        if (!proceedAnyway) return false;
      }

      const replaceRes = await fetch("/api/lumen/replace-months", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, datasetId, months: overlappingMonths }),
      });
      const replaceJson = await replaceRes.json();
      if (!replaceRes.ok) throw new Error(replaceJson.error || "Could not clear the old months");
    }

    const batches = [];
    for (let i = 0; i < rows.length; i += UPLOAD_BATCH_SIZE) {
      batches.push(rows.slice(i, i + UPLOAD_BATCH_SIZE));
    }

    let inserted = 0;
    try {
      for (let i = 0; i < batches.length; i++) {
        setUploadProgress(`${fileLabel}: batch ${i + 1} of ${batches.length}…`);
        const res = await fetch("/api/lumen/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year,
            datasetId,
            sourceFile: fileName,
            rows: batches[i],
            // Tells the server which duplicate-check mode is safe to run:
            // with a real per-row identifier mapped, each row already
            // carries its own uniqueId (part of ParsedSalesRow), so the
            // server can dedupe-and-continue using the SAME strong key
            // this file was already deduped with above; without one, it
            // falls back to the original reject-and-ask behavior, since
            // there's no way to tell a real duplicate apart from two
            // different customers who coincidentally share every tracked
            // column.
            hasUniqueId: Boolean(mapping.uniqueId),
            // Reported once (on the first batch only) — the whole file's
            // duplicates were already found and dropped above, before
            // batching, so there is exactly one summary for this upload.
            ...(i === 0 && duplicatesRemoved.count > 0 ? { duplicatesRemoved } : {}),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Upload failed");
        inserted += json.inserted;
      }
    } catch (err) {
      // A batch failed partway through — rather than leave this file's
      // months half-written (some areas present, others missing, with no
      // visible sign anything went wrong), roll back everything this
      // attempt touched so the month is either fully there or not there
      // at all, never a silent partial mix.
      await fetch("/api/lumen/replace-months", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, datasetId, months: monthsInFile }),
      }).catch(() => {});
      throw new Error(
        `${err instanceof Error ? err.message : "Upload failed"} — the partial data from this attempt was rolled back. Please try again.`,
      );
    }

    // Final sanity check: does the dataset actually now hold as many rows
    // for these months as we just inserted? This should always match —
    // the within-file dedup above and the database's own uniqueness
    // constraint both prevent a mismatch — but this is the one place we
    // can catch anything neither of those anticipated before the user
    // walks away trusting a silently wrong number.
    const warnings: string[] = [];
    if (skipped.count > 0) {
      warnings.push(
        `${fileLabel}: skipped ${skipped.count} row(s) that couldn't be read (${skipped.examples.join("; ") || "missing area/item/value/month"}) — check the source file for those rows.`,
      );
    }
    if (duplicatesRemoved.count > 0) {
      warnings.push(
        `${fileLabel}: removed ${duplicatesRemoved.count} row(s) repeated identically within this file ` +
          `(e.g. ${duplicatesRemoved.examples.join("; ") || "a repeated row"}) — kept one copy of each, logged in the Correction log.`,
      );
    }
    try {
      const countRes = await fetch(
        `/api/lumen/sales-records/count?year=${year}&datasetId=${datasetId}&months=${monthsInFile.join(",")}`,
      );
      const countJson = await countRes.json();
      if (countRes.ok && typeof countJson.count === "number" && countJson.count !== inserted) {
        warnings.push(
          `${fileLabel}: expected ${inserted} rows for this upload, but the dataset now has ${countJson.count} for these months — please check the Correction log and this area's numbers before relying on them.`,
        );
      }
    } catch {
      // best-effort only; not being able to verify isn't itself an error
    }

    return { inserted, warning: warnings.length > 0 ? warnings.join(" | ") : undefined };
  }

  async function handleWizardConfirm(choice: WizardChoice) {
    const files = pendingFiles;
    setPendingFiles([]);
    if (files.length === 0) return;

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    try {
      let datasetId: string;
      let mapping: ColumnMapping;

      if (choice.mode === "new") {
        const res = await fetch("/api/lumen/datasets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: choice.name, columnMapping: choice.mapping }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not create the dataset");
        datasetId = json.dataset.id;
        mapping = json.dataset.columnMapping;
        setDatasets((prev) => [json.dataset, ...prev]);
      } else {
        datasetId = choice.datasetId;
        const existing = datasets.find((d) => d.id === datasetId);
        if (!existing) throw new Error("Dataset not found");
        mapping = existing.columnMapping;
      }

      let successCount = 0;
      let totalInserted = 0;
      const failures: string[] = [];
      const warnings: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const { file, sheet } = files[i];
        const fileLabel = files.length > 1 ? `${file.name} (${i + 1}/${files.length})` : file.name;
        try {
          const result = await uploadRowsToDataset(datasetId, mapping, sheet, file.name, fileLabel);
          if (result !== false) {
            successCount++;
            totalInserted += result.inserted;
            if (result.warning) warnings.push(result.warning);
          }
        } catch (err) {
          failures.push(`${file.name}: ${err instanceof Error ? err.message : "Upload failed"}`);
        }
      }

      if (successCount > 0) {
        setUploadMessage(
          files.length > 1
            ? `Uploaded ${successCount} of ${files.length} files (${formatNumber(totalInserted)} rows).`
            : `Uploaded and processed ${files[0].file.name} (${formatNumber(totalInserted)} rows).`,
        );
        setSelectedDatasetId(datasetId);
        setExpanded(new Set());
        await fetchReport(datasetId, year);
      }
      if (warnings.length > 0) {
        setUploadError((prev) => [prev, ...warnings].filter(Boolean).join(" | "));
      }
      if (failures.length > 0) {
        setUploadError(failures.join(" | "));
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleSaveSalesMapping(mapping: ColumnMapping) {
    if (!selectedDatasetId) return;
    try {
      const res = await fetch(`/api/lumen/datasets/${selectedDatasetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnMapping: mapping }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update the mapping");
      setDatasets((prev) => prev.map((d) => (d.id === selectedDatasetId ? { ...d, columnMapping: mapping } : d)));
      setShowEditSalesMapping(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not update the mapping");
    }
  }

  async function handleEditSalesCell(area: string, family: string, month: number, newValue: number, isUndo = false) {
    if (!selectedDatasetId) return;
    try {
      const res = await fetch("/api/lumen/sales-records/cell", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: selectedDatasetId, year, month, area, family, newValue, isUndo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t.inlineEdit.saveFailed);
      await fetchReport(selectedDatasetId, year);
      if (!isUndo) {
        armUndo({ kind: "sales", area, family, month, oldValue: json.oldValue, newValue: json.newValue });
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t.inlineEdit.saveFailed);
    }
  }

  async function handleEditLinkedField(recordId: string, key: string, newValue: string, isUndo = false) {
    if (!selectedDatasetId) return;
    try {
      const res = await fetch(`/api/lumen/dataset-records/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, newValue, isUndo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t.inlineEdit.saveFailed);
      await fetchLinkedRecords(selectedDatasetId, year);
      await fetchDataEdits(selectedDatasetId);
      if (!isUndo) {
        armUndo({ kind: "linked", recordId, key, oldValue: json.oldValue, newValue: json.newValue });
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t.inlineEdit.saveFailed);
    }
  }

  // Renames an item/area name across the whole dataset (Sales, Targets,
  // Rep assignment history, linked files) — the identity every level of
  // the report groups and matches by, unlike sales-records/cell's
  // per-cell VALUE edit. See src/app/api/lumen/sales-records/rename for
  // exactly which tables get updated.
  async function handleRenameSalesField(field: "area" | "item", oldValue: string, newValue: string, isUndo = false) {
    if (!selectedDatasetId || oldValue === newValue) return;
    try {
      const res = await fetch("/api/lumen/sales-records/rename", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: selectedDatasetId, field, oldValue, newValue, isUndo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t.inlineEdit.saveFailed);
      await fetchReport(selectedDatasetId, year);
      if (!isUndo) armUndo({ kind: "rename", field, oldValue, newValue });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t.inlineEdit.saveFailed);
    }
  }

  // Same idea for the IMS side (Market Insights) — renames an area,
  // product, or company name across every IMS file in the dataset.
  async function handleUndo() {
    if (!lastEdit) return;
    const edit = lastEdit;
    clearUndo();
    if (edit.kind === "sales") {
      await handleEditSalesCell(edit.area, edit.family, edit.month, edit.oldValue, true);
    } else if (edit.kind === "linked") {
      await handleEditLinkedField(edit.recordId, edit.key, String(edit.oldValue), true);
    } else if (edit.kind === "rename") {
      await handleRenameSalesField(edit.field, edit.newValue, edit.oldValue, true);
    } else {
      await handleRenameImsField(edit.field, edit.newValue, edit.oldValue, true);
    }
  }

  // Ctrl/Cmd+Z anywhere outside a text field undoes the last inline edit.
  // Placed here, below handleUndo, rather than up with the other effects:
  // from up there it was reading a function declared hundreds of lines
  // later, which is both hard to follow and a real hazard — the listener
  // would capture whichever version existed at that point.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      handleUndo();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEdit, selectedDatasetId, year]);

  async function handleExport(format: ExportFormat, selectedIds: Set<string>) {
    if (!report || "error" in report) return;
    const dataset = datasets.find((d) => d.id === selectedDatasetId);

    setExporting(true);
    try {
      const ctx = {
        report,
        t,
        lang,
        datasetName: dataset?.name ?? "Lumen",
        selectedIds,
        imsReport,
      };
      if (format === "pdf") {
        const { exportToPdf } = await import("@/lib/lumen/exportPdf");
        await exportToPdf(ctx);
      } else {
        const { exportToPptx } = await import("@/lib/lumen/exportPptx");
        await exportToPptx(ctx);
      }
      setShowExportModal(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function toggle(area: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  }

  function selectArea(area: string) {
    setExpanded((prev) => new Set(prev).add(area));
    requestAnimationFrame(() => {
      document.getElementById(areaCardId(area))?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function selectItem(item: string) {
    setExpandedItems((prev) => new Set(prev).add(item));
    requestAnimationFrame(() => {
      document.getElementById(itemCardId(item))?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function selectRep(rep: string) {
    setExpandedReps((prev) => new Set(prev).add(rep));
    requestAnimationFrame(() => {
      document.getElementById(repCardId(rep))?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function toggleItem(item: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  function toggleRep(rep: string) {
    setExpandedReps((prev) => {
      const next = new Set(prev);
      if (next.has(rep)) next.delete(rep);
      else next.add(rep);
      return next;
    });
  }

  function findingsForItem(item: string): { areas: string[]; lines: string[] } {
    const areasForItem: string[] = [];
    const linesForItem: string[] = [];
    if (!report || "error" in report) return { areas: areasForItem, lines: linesForItem };
    for (const f of report.findings) {
      if (f.type === "local_drop" && f.rootCauseFamily === item) areasForItem.push(f.area);
      if (f.type === "systemic_drop" && f.rootCauseFamily === item) linesForItem.push(f.line);
    }
    return { areas: areasForItem, lines: linesForItem };
  }

  // Shared between the per-area "byItem" breakdown and the top-level,
  // all-areas "Items" list — both expand the exact same trend/ranking/root
  // cause detail for a given item, the only difference being which
  // aggregate (one area's vs. every area's) the row above it shows.
  function renderItemDetail(item: string) {
    if (!report || "error" in report) return null;
    const itemSeries = report.itemMonthlySeries[item] ?? [];
    const areaRanking = Object.entries(report.areaFamilyChanges)
      .map(([a, changes]) => [a, changes[item]] as const)
      .filter((entry): entry is [string, (typeof report.areaFamilyChanges)[string][string]] => entry[1] !== undefined)
      .sort((a, b) => b[1].currValue - a[1].currValue);
    const { areas: rootCauseAreas, lines: rootCauseLines } = findingsForItem(item);

    return (
      <div className="ms-4 mt-2 space-y-3 rounded-lg bg-surf2/60 p-3">
        {itemSeries.length >= 2 && (
          <div>
            <div className="mb-1 text-[11px] font-semibold text-white">
              {t.dashboard.trendLastMonths(itemSeries.length)} —{" "}
              <span className="text-amber">{unitLabel}</span>
            </div>
            {/* Units where the file has a quantity column, money where it
                doesn't — named either way, because a chart that silently
                switched between the two would be worse than one that only
                ever showed money. */}
            <ItemTrendChart
              label={item}
              series={itemSeries}
              showUnits={showsUnits}
              unitLabel={unitLabel}
            />
            {!showsUnits && <div className="mt-1 text-[10px] text-muted">{t.units.valueNote}</div>}
          </div>
        )}

        {areaRanking.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] font-semibold text-white">{t.dashboard.byAreaMonth(report.latestMonth)}</div>
            <div className="space-y-1">
              {areaRanking.map(([a, changes], i) => (
                <div key={a} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 flex-1 truncate text-muted" dir="auto">
                    {a}
                    {i === 0 && areaRanking.length > 1 && (
                      <span className="ms-1.5 rounded-full border border-green/40 px-1.5 py-0.5 text-[9px] text-green">
                        {t.dashboard.top}
                      </span>
                    )}
                    {i === areaRanking.length - 1 && areaRanking.length > 1 && (
                      <span className="ms-1.5 rounded-full border border-red/40 px-1.5 py-0.5 text-[9px] text-red">
                        {t.dashboard.lowest}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-white">{formatNumber(changes.currValue)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(rootCauseAreas.length > 0 || rootCauseLines.length > 0) && (
          <div className="text-[11px] text-muted">
            <span className="font-semibold text-amber">{t.dashboard.rootCauseFor} </span>
            {[
              ...rootCauseAreas,
              ...rootCauseLines.map((c) => (c === "All areas" ? t.dashboard.theLineWideDrop : t.dashboard.theLineWideDropIn(c))),
            ].join(", ")}
          </div>
        )}
      </div>
    );
  }

  const hasError = report && "error" in report;
  const areas =
    report && !hasError
      ? Object.entries(report.areas).sort((a, b) => {
          const pa = a[1].pctChange ?? Infinity;
          const pb = b[1].pctChange ?? Infinity;
          return pa - pb;
        })
      : [];

  const findingsByArea = new Map<string, Finding[]>();
  if (report && !hasError) {
    for (const f of report.findings) {
      if (f.type === "systemic_drop") continue;
      const list = findingsByArea.get(f.area) ?? [];
      list.push(f);
      findingsByArea.set(f.area, list);
    }
  }

  const systemicFindings =
    report && !hasError
      ? report.findings.filter((f): f is Extract<Finding, { type: "systemic_drop" }> => f.type === "systemic_drop")
      : [];

  // Item charts plot units where the dataset has a quantity column. Named
  // on every chart rather than inferred from the size of the numbers.
  const showsUnits = Boolean(report && !hasError && report.hasQuantity);
  const unitLabel = showsUnits ? t.units.units : t.units.value;

  // --- Org structure ---------------------------------------------------
  // Every area in the dataset, whether or not it has been assigned to
  // anyone yet, so the assign screen can offer the ones still uncovered.
  const allAreaNames = areas.map(([area]) => area);
  // Rep names from the sales data, the assignments and the manager links
  // alike — a rep can exist in any of the three and not the others.
  const repNames = knownReps(
    assignments,
    managerLinks,
    report && !hasError && report.hasReps ? Object.keys(report.repChanges) : [],
  );
  const orgChart = buildOrgChart(
    managerLinks,
    assignments,
    report && !hasError
      ? Object.fromEntries(
          Object.entries(report.areas).map(([area, d]) => [area, { currValue: d.currValue, pctChange: d.pctChange }]),
        )
      : {},
    report && !hasError ? report.latestMonth : null,
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg sm:flex-row">
      <Sidebar userEmail={userEmail}>
        {activeTab === "sales" && (
        <>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt,.ods"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) handleFilesSelected(files);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mb-2 w-full rounded-lg border border-dashed border-bdr px-3 py-2.5 text-sm text-muted transition-colors hover:border-amber hover:text-white disabled:opacity-60"
        >
          {uploading ? uploadProgress ?? t.sidebar.uploading : t.sidebar.upload}
        </button>

        {selectedDatasetId && (
          <>
            <input
              ref={targetsFileInputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt,.ods"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleTargetsFileSelected(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => targetsFileInputRef.current?.click()}
              disabled={uploading}
              className="mb-2 w-full rounded-lg border border-dashed border-bdr px-3 py-2.5 text-sm text-muted transition-colors hover:border-amber hover:text-white disabled:opacity-60"
            >
              {t.sidebar.uploadTargets}
            </button>
            <button
              type="button"
              onClick={() => setShowAssignAreas(true)}
              disabled={uploading}
              className="mb-2 w-full rounded-lg border border-dashed border-bdr px-3 py-2.5 text-sm text-muted transition-colors hover:border-amber hover:text-white disabled:opacity-60"
            >
              {t.org.assignAreasButton}
            </button>
            <button
              type="button"
              onClick={() => setShowAssignManagers(true)}
              disabled={uploading}
              className="mb-2 w-full rounded-lg border border-dashed border-bdr px-3 py-2.5 text-sm text-muted transition-colors hover:border-amber hover:text-white disabled:opacity-60"
            >
              {t.org.assignManagersButton}
            </button>
          </>
        )}

        <label className="mb-2 flex items-center justify-between gap-2 text-sm text-muted">
          {t.sidebar.year}
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-20 rounded-lg border border-bdr bg-surf2 px-2 py-1.5 font-mono text-sm text-white outline-none focus:border-amber"
          />
        </label>
        <button
          onClick={() => {
            clearUndo();
            if (selectedDatasetId) fetchReport(selectedDatasetId, year);
          }}
          disabled={loadingReport || !selectedDatasetId}
          className="w-full rounded-lg bg-gradient-to-br from-amber to-[var(--amber-2)] px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
        >
          {loadingReport ? t.sidebar.loading : t.sidebar.analyze}
        </button>
        </>
        )}

        {/* Shared by both the Sales and IMS upload flows, so this stays
            visible regardless of which tab is active. */}
        {uploadError && <p className="mb-2 mt-2 break-words text-xs text-red">{uploadError}</p>}
        {uploadMessage && <p className="mb-2 mt-2 break-words text-xs text-green">{uploadMessage}</p>}

        {datasets.length > 0 && (
          <div className="mt-4 border-t border-bdr pt-4">
            <div className="mb-2 text-xs font-semibold text-muted">{t.sidebar.datasets}</div>
            <div className="flex flex-col gap-1.5">
              {datasets.map((d) => {
                const isSelected = d.id === selectedDatasetId;
                return (
                  <div key={d.id} className="flex items-center gap-1.5">
                    <button
                      onClick={() => selectDataset(d.id)}
                      title={d.name}
                      dir="auto"
                      className={`min-w-0 flex-1 truncate rounded-lg border px-3 py-1.5 text-start text-sm transition-colors ${
                        isSelected
                          ? "border-amber bg-amber/10 text-white"
                          : "border-bdr text-muted hover:text-white"
                      }`}
                    >
                      {d.name}
                    </button>
                    {isSelected && d.userId === userId && (
                      <>
                        <button
                          onClick={() => setShowEditSalesMapping(true)}
                          title={t.editMapping.editSalesButton}
                          aria-label={t.editMapping.editSalesButton}
                          className="shrink-0 rounded-lg border border-bdr px-2.5 py-1.5 text-muted transition-colors hover:border-amber hover:text-amber"
                        >
                          ⚙
                        </button>
                        <button
                          onClick={() => handleDeleteDataset(d)}
                          title={t.sidebar.deleteDataset(d.name)}
                          aria-label={t.sidebar.deleteDataset(d.name)}
                          className="shrink-0 rounded-lg border border-bdr px-2.5 py-1.5 text-muted transition-colors hover:border-red hover:text-red"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "sales" && selectedDatasetId && (
          <LinkedFilesPanel
            files={linkedFiles}
            disabled={uploading}
            onAddFile={handleAddLinkedFile}
            onReplaceFile={handleReplaceLinkedFile}
            onDeleteFile={handleDeleteLinkedFile}
            onEditJoinKeys={handleEditJoinKeys}
          />
        )}

        {activeTab === "sales" && selectedDatasetId && (
          <button
            onClick={() => setShowCorrectionLog(true)}
            className="mt-4 w-full rounded-lg border border-bdr px-3 py-2 text-xs text-muted transition-colors hover:border-amber hover:text-white"
          >
            {t.corrections.logButton}
          </button>
        )}
      </Sidebar>

      {pendingFiles.length > 0 && (
        <UploadWizardModal
          fileName={pendingFiles[0].file.name}
          extraFilesCount={pendingFiles.length - 1}
          sheet={pendingFiles[0].sheet}
          datasets={datasets}
          defaultDatasetId={selectedDatasetId}
          onCancel={() => setPendingFiles([])}
          onConfirm={handleWizardConfirm}
        />
      )}

      {pendingTargetsFile && pendingTargetsSheet && selectedDatasetId && (
        <UploadTargetsModal
          fileName={pendingTargetsFile.name}
          sheet={pendingTargetsSheet}
          dataset={datasets.find((d) => d.id === selectedDatasetId)!}
          onCancel={() => {
            setPendingTargetsFile(null);
            setPendingTargetsSheet(null);
          }}
          onConfirm={handleTargetsConfirm}
        />
      )}

      {pendingLinkedFile && selectedDatasetId && (
        <AddLinkedFileModal
          fileName={pendingLinkedFile.file.name}
          sheet={pendingLinkedFile.sheet}
          salesMapping={datasets.find((d) => d.id === selectedDatasetId)!.columnMapping}
          existingFile={replacingLinkedFileId ? linkedFiles.find((f) => f.id === replacingLinkedFileId) : undefined}
          onCancel={() => {
            setPendingLinkedFile(null);
            setReplacingLinkedFileId(null);
          }}
          onConfirm={handleLinkedFileConfirm}
        />
      )}

      {pendingImsFile && selectedDatasetId && (
        <AddImsFileModal
          fileName={pendingImsFile.file.name}
          file={pendingImsFile.file}
          sheet={pendingImsFile.sheet}
          onCancel={() => setPendingImsFile(null)}
          onConfirm={handleImsFileConfirm}
        />
      )}

      {showCorrectionLog && (
        <CorrectionLogModal dataEdits={dataEdits} onClose={() => setShowCorrectionLog(false)} />
      )}

      {lastEdit && <UndoToast onUndo={handleUndo} onDismiss={clearUndo} />}

      {showEditSalesMapping && selectedDatasetId && (
        <EditSalesMappingModal
          mapping={datasets.find((d) => d.id === selectedDatasetId)!.columnMapping}
          onCancel={() => setShowEditSalesMapping(false)}
          onSave={handleSaveSalesMapping}
        />
      )}

      {showAssignAreas && selectedDatasetId && (
        <AssignAreasModal
          areas={allAreaNames}
          existingReps={repNames}
          saving={savingOrg}
          onCancel={() => setShowAssignAreas(false)}
          onSave={handleAssignAreas}
        />
      )}

      {showAssignManagers && selectedDatasetId && (
        <AssignManagersModal
          reps={repNames}
          links={managerLinks}
          saving={savingOrg}
          onCancel={() => setShowAssignManagers(false)}
          onSave={handleAssignManager}
        />
      )}

      {showExportModal && report && !("error" in report) && (
        <ExportModal
          groups={buildExportItems(report, t, imsReport)}
          exporting={exporting}
          onCancel={() => setShowExportModal(false)}
          onExport={handleExport}
        />
      )}

      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-4xl">
      {report && !hasError && (
        <GlobalSearch
          areas={areas.map(([area]) => area)}
          items={Object.keys(report.familyChanges)}
          reps={report.hasReps ? Object.keys(report.repChanges) : []}
          marketGroups={(imsReport?.areaProducts ?? []).map(imsGroupLabel)}
          // Market Insights isn't fetched on page load any more (see P1), so
          // load it when someone starts searching — otherwise its groups
          // would be findable only after visiting that tab once.
          onFocus={ensureImsLoaded}
          onSelect={(group, name) => {
            if (group === "market") {
              setActiveTab("ims");
              setImsFocusGroup(name);
              return;
            }
            if (activeTab !== "sales") setActiveTab("sales");
            if (group === "area") selectArea(name);
            else if (group === "item") selectItem(name);
            else selectRep(name);
          }}
        />
      )}
      {selectedDatasetId && (
        <div className="mb-5 flex gap-1 border-b border-bdr">
          <button
            type="button"
            onClick={() => setActiveTab("sales")}
            className={`border-b-2 px-3 py-2 text-sm transition-colors ${
              activeTab === "sales" ? "border-amber text-white" : "border-transparent text-muted hover:text-white"
            }`}
          >
            {t.ims.salesTabLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("ims");
              ensureImsLoaded();
            }}
            className={`border-b-2 px-3 py-2 text-sm transition-colors ${
              activeTab === "ims" ? "border-amber text-white" : "border-transparent text-muted hover:text-white"
            }`}
          >
            {t.ims.tabLabel}
          </button>
        </div>
      )}

      {activeTab === "ims" && selectedDatasetId && (
        <ImsPanel
          key={imsFocusGroup ?? "ims-panel"}
          focusGroup={imsFocusGroup}
          report={imsReport}
          files={imsFiles}
          loading={imsLoading}
          disabled={uploading}
          onAddFile={handleAddImsFile}
          onDeleteFile={handleDeleteImsFile}
          onRenameGroup={(ap, newLabel) => {
            // A group is "about" its product when the file has one, else
            // its area (see ImsPanel's own groupLabel) — rename whichever
            // one actually holds the displayed name.
            if (ap.product !== null) handleRenameImsField("product", ap.product, newLabel);
            else if (ap.area !== null) handleRenameImsField("area", ap.area, newLabel);
          }}
          onRenameCompany={(oldName, newName) => handleRenameImsField("company", oldName, newName)}
        />
      )}

      {activeTab === "sales" && (
      <>
      {hasError && (
        <div className="rounded-2xl border border-bdr bg-surf p-5 text-sm text-muted">
          {report && "error" in report ? report.error : null}
        </div>
      )}

      {report && !hasError && (
        <div key={`${selectedDatasetId}-${report.year}-${report.comparedToMonth}-${report.latestMonth}-${areas.length}`}>
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => {
                // Market Insights isn't fetched on page load any more, so
                // make sure it's here before offering it in the checklist.
                ensureImsLoaded();
                setShowExportModal(true);
              }}
              className="rounded-lg border border-bdr px-4 py-2 text-sm text-muted transition-colors hover:border-amber hover:text-white"
            >
              {t.export.button}
            </button>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label={t.dashboard.areasAnalyzed} value={String(areas.length)} delayMs={0} />
            <StatTile
              label={t.dashboard.inDecline}
              value={String(areas.filter(([, d]) => d.pctChange !== null && d.pctChange < 0).length)}
              tone="red"
              delayMs={60}
            />
            <StatTile
              label={t.dashboard.pattern}
              value={report.isSystemicDrop ? t.dashboard.lineWide : findingsByArea.size > 0 ? t.dashboard.localized : t.dashboard.stable}
              tone={report.isSystemicDrop ? "red" : findingsByArea.size > 0 ? "amber" : "green"}
              delayMs={120}
            />
            <StatTile label={t.dashboard.decisionsRaised} value={String(report.findings.length)} tone="amber" delayMs={180} />
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <div>
              {t.dashboard.comparingMonth(report.comparedToMonth, report.latestMonth)}
              {" — "}
              {report.isSystemicDrop ? (
                <span className="font-semibold text-red">{t.dashboard.systemicDetected}</span>
              ) : (
                <span className="text-green">{t.dashboard.noSystemicPattern}</span>
              )}
            </div>
            {report.hasTargets && (
              <label className="flex items-center gap-2 text-xs text-muted">
                {t.targets.thresholdLabel}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={targetThreshold}
                  onChange={(e) => setTargetThreshold(Number(e.target.value))}
                  className="w-16 rounded-lg border border-bdr bg-surf2 px-2 py-1 font-mono text-xs text-white outline-none focus:border-amber"
                />
                %
              </label>
            )}
          </div>

          {selectedDatasetId && managerLinks.length > 0 && (
            <ManagerCards
              managers={orgChart}
              datasetId={selectedDatasetId}
              year={year}
              hasQuantity={report.hasQuantity}
            />
          )}

          {report.targetMonthMismatch && (
            <div className="mb-4 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber">
              {t.targets.monthMismatch(
                report.targetMonthMismatch.targetMonths.join(", "),
                report.targetMonthMismatch.latestMonth,
              )}
            </div>
          )}

          {systemicFindings.map((f, i) => (
            <div key={i} className="mb-5 rounded-2xl border border-red/40 bg-red/10 p-5">
              <p className="mb-2 break-words text-sm">
                {report.hasLines && <span className="font-semibold text-white">{f.line}: </span>}
                {findingSummary(f, report, t)}
              </p>
              <div className="break-words rounded-lg bg-surf2 px-3 py-2 text-sm">
                <span className="font-semibold text-amber">{t.dashboard.decision} </span>
                {findingDecision(f, t)}
              </div>
            </div>
          ))}

          <div className="mb-5">
            <AreaChangeBars areas={areas} onSelectArea={selectArea} />
          </div>

          <div className="mb-5">
            <FamilyChangeBars families={report.familyChanges} />
          </div>

          {Object.keys(report.familyChanges).length > 0 && (
            <div className="mb-5 rounded-2xl border border-bdr bg-surf p-4 sm:p-5">
              <h3 className="mb-2 text-xs font-semibold text-white">{t.dashboard.allItems}</h3>
              <div className="space-y-2">
                {Object.entries(report.familyChanges)
                  .sort((a, b) => (a[1].pctChange ?? Infinity) - (b[1].pctChange ?? Infinity))
                  .map(([fam, fc]) => {
                    const itemOpen = expandedItems.has(fam);
                    return (
                      <div key={fam} id={itemCardId(fam)} className="scroll-mt-4 text-xs">
                        <button
                          onClick={() => toggleItem(fam)}
                          className="flex w-full items-center gap-2 rounded-lg text-start transition-colors hover:bg-surf2/60"
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorForFamily(fam) }} />
                          <span className="min-w-0 flex-1 truncate text-muted" dir="auto">{fam}</span>
                          <span
                            className={`shrink-0 font-mono ${
                              fc.pctChange !== null && fc.pctChange < 0 ? "text-red" : "text-green"
                            }`}
                          >
                            {fc.pctChange !== null && fc.pctChange > 0 ? "+" : ""}
                            {fc.pctChange ?? "—"}
                            {fc.pctChange !== null ? "%" : ""}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted">{itemOpen ? t.common.hide : t.common.details}</span>
                        </button>
                        <div className="ps-4 font-mono text-[11px] break-words text-muted">
                          {t.common.month(report.comparedToMonth)}: {formatNumber(fc.prevValue)} →{" "}
                          {t.common.month(report.latestMonth)}: {formatNumber(fc.currValue)}
                        </div>
                        {itemOpen && renderItemDetail(fam)}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {report.hasReps && (
            <div className="mb-5">
              <RepLeaderboard
                repChanges={report.repChanges}
                repTargets={report.repTargets}
                hasTargets={report.hasTargets}
              />
            </div>
          )}

          {report.hasReps && (
            <div className="mb-5">
              <FamilyChangeBars families={report.repChanges} title={t.dashboard.repComparison} />
            </div>
          )}

          {report.hasReps && (
            <div className="mb-5 rounded-2xl border border-bdr bg-surf p-4 sm:p-5">
              <h3 className="mb-2 text-xs font-semibold text-white">{t.dashboard.byRep}</h3>
              <div className="space-y-2">
                {Object.entries(report.repChanges)
                  .sort((a, b) => (a[1].pctChange ?? Infinity) - (b[1].pctChange ?? Infinity))
                  .map(([rep, rc]) => {
                    const repOpen = expandedReps.has(rep);
                    const repSeries = report.repMonthlySeries[rep] ?? [];
                    return (
                      <div key={rep} id={repCardId(rep)} className="scroll-mt-4 text-xs">
                        <button
                          onClick={() => toggleRep(rep)}
                          className="flex w-full items-center gap-2 rounded-lg text-start transition-colors hover:bg-surf2/60"
                        >
                          <span className="min-w-0 flex-1 truncate text-muted" dir="auto">{rep}</span>
                          <span
                            className={`shrink-0 font-mono ${
                              rc.pctChange !== null && rc.pctChange < 0 ? "text-red" : "text-green"
                            }`}
                          >
                            {rc.pctChange !== null && rc.pctChange > 0 ? "+" : ""}
                            {rc.pctChange ?? "—"}
                            {rc.pctChange !== null ? "%" : ""}
                          </span>
                          <TargetChip progress={report.repTargets[rep]} threshold={targetThreshold} t={t} />
                          <span className="shrink-0 text-[10px] text-muted">{repOpen ? t.common.hide : t.common.details}</span>
                        </button>
                        <div className="ps-4 font-mono text-[11px] break-words text-muted">
                          {t.common.month(report.comparedToMonth)}: {formatNumber(rc.prevValue)} →{" "}
                          {t.common.month(report.latestMonth)}: {formatNumber(rc.currValue)}
                        </div>
                        {repOpen && (
                          <div className="ms-4 mt-2 space-y-2 rounded-lg bg-surf2/60 p-3">
                            {report.repTargets[rep] &&
                              report.repTargets[rep].pctOfTarget !== null &&
                              report.repTargets[rep].pctOfTarget! < targetThreshold && (
                                <p className="rounded-lg bg-red/10 px-2 py-1.5 text-[11px] font-semibold text-red">
                                  {t.targets.underTargetBy(Math.round((100 - report.repTargets[rep].pctOfTarget!) * 10) / 10)}
                                </p>
                              )}
                            {repSeries.length >= 2 && (
                              <div>
                                <div className="mb-1 text-[11px] font-semibold text-white">
                                  {t.dashboard.trendLastMonths(repSeries.length)}
                                </div>
                                <TrendChart
                                  areaLabel={rep}
                                  areaSeries={repSeries}
                                  lineSeries={report.repAverageSeries}
                                  compareShortLabel={t.chart.repAvg}
                                  compareLabel={t.chart.allRepsAverage}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <h2 className="mb-3 text-sm font-semibold text-white">{t.dashboard.allAreas}</h2>
          <div className="space-y-3">
            {areas.map(([area, d]) => {
              const areaFindings = findingsByArea.get(area) ?? [];
              const isOpen = expanded.has(area);
              const lineSummary = report.lines[d.line];
              const areaLineSystemic = lineSummary?.isSystemicDrop ?? false;
              const causeLine =
                areaFindings.length > 0
                  ? findingSummary(areaFindings[0], report, t)
                  : areaLineSystemic && d.pctChange !== null && d.pctChange <= -15
                    ? t.dashboard.partOfLineDrop
                    : t.dashboard.noChangeThisMonth;

              const lineSeries = lineSummary?.monthlySeries ?? [];
              const lineLast = lineSeries[lineSeries.length - 1];
              const linePrev = lineSeries[lineSeries.length - 2];
              const linePct =
                lineLast && linePrev && linePrev.avgValue !== 0
                  ? Math.round(((lineLast.avgValue - linePrev.avgValue) / linePrev.avgValue) * 1000) / 10
                  : null;

              const areaAssignments = assignments.filter((a) => a.area === area);
              const responsibleInLatest = repResponsibleInMonth(areaAssignments, area, report.latestMonth);

              const linkedContext = linkedFiles
                .map((f) => ({ file: f, records: recordsForAreaMonth(f, linkedRecords, area, report.latestMonth) }))
                .filter((entry) => entry.records.length > 0);

              return (
                <div
                  key={area}
                  id={areaCardId(area)}
                  className="scroll-mt-4 rounded-2xl border border-bdr bg-surf p-5 transition-colors"
                >
                  <div
                    onClick={() => toggle(area)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && toggle(area)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 text-start"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <EditableFieldValue
                          value={area}
                          className="truncate font-medium"
                          title={t.inlineEdit.renameHint}
                          onSave={(v) => handleRenameSalesField("area", area, v.trim())}
                        />
                        {report.hasLines && (
                          <span className="shrink-0 rounded-full border border-bdr px-1.5 py-0.5 text-[10px] text-muted" dir="auto">
                            {d.line}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted">{causeLine}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <TargetChip progress={report.areaTargets[area]} threshold={targetThreshold} t={t} />
                      <Badge pctChange={d.pctChange} />
                      <span className="text-xs text-muted">{isOpen ? t.common.hide : t.common.details}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-4 space-y-5 border-t border-bdr pt-4 text-sm">
                      <div>
                        <p className="mb-2">
                          {t.dashboard.valueLabel} {t.common.month(report.comparedToMonth)}:{" "}
                          <span className="font-mono text-white">{formatNumber(d.prevValue)}</span> →{" "}
                          {t.common.month(report.latestMonth)}:{" "}
                          <span className="font-mono text-white">{formatNumber(d.currValue)}</span>.{" "}
                          {t.dashboard.quantityLabel} {t.common.month(report.comparedToMonth)}:{" "}
                          <span className="font-mono text-white">{formatNumber(d.prevQty)}</span> →{" "}
                          {t.common.month(report.latestMonth)}:{" "}
                          <span className="font-mono text-white">{formatNumber(d.currQty)}</span>.
                        </p>
                        {report.areaTargets[area] &&
                          report.areaTargets[area].pctOfTarget !== null &&
                          report.areaTargets[area].pctOfTarget! < targetThreshold && (
                            <p className="mb-2 rounded-lg bg-red/10 px-3 py-2 text-xs font-semibold text-red">
                              {t.targets.underTargetBy(Math.round((100 - report.areaTargets[area].pctOfTarget!) * 10) / 10)}
                            </p>
                          )}
                        {linePct !== null && (
                          <p className="mb-2 text-xs text-muted">
                            {t.dashboard.areaMovedVs(
                              d.pctChange ?? 0,
                              report.hasLines ? d.line : t.dashboard.lineWord,
                              linePct,
                            )}
                          </p>
                        )}
                        {responsibleInLatest && (
                          <p className="mb-2 text-xs text-muted" dir="auto">
                            {t.repHistory.responsibleInMonth(
                              t.common.month(report.latestMonth),
                              responsibleInLatest.rep ?? t.repHistory.vacant,
                            )}
                            {/* The manager above them, but only when an org
                                structure has actually been defined — with
                                none, this line reads exactly as before. */}
                            {managerForRep(managerLinks, responsibleInLatest.rep) && (
                              <span className="ms-2 text-amber">
                                {t.org.managerOf(managerForRep(managerLinks, responsibleInLatest.rep)!)}
                              </span>
                            )}
                          </p>
                        )}
                        <table className="w-full text-start">
                          <tbody>
                            <tr className="text-muted">
                              <td className="py-1 pe-4">{t.dashboard.decliningStreak}</td>
                              <td className="py-1 text-white">{d.decliningStreak ? t.dashboard.yes : t.dashboard.no}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {d.monthlySeries.length >= 2 && (
                        <div>
                          <div className="mb-2 text-xs font-semibold text-white">
                            {t.dashboard.trendLastMonths(d.monthlySeries.length)}
                          </div>
                          <TrendChart
                            areaLabel={area}
                            areaSeries={d.monthlySeries}
                            lineSeries={lineSeries}
                          />
                        </div>
                      )}

                      {(() => {
                        const familyEntries = Object.entries(report.areaFamilyChanges[area] ?? {}).sort(
                          (a, b) => b[1].absDrop - a[1].absDrop,
                        );
                        if (familyEntries.length === 0) return null;
                        return (
                        <div>
                          <div className="mb-2 text-xs font-semibold text-white">{t.dashboard.byItem}</div>
                          <div className="space-y-2">
                            {familyEntries.map(([fam, fc]) => {
                              const itemOpen = expandedItems.has(fam);

                              return (
                              <div key={fam} className="text-xs">
                                <div
                                  onClick={() => toggleItem(fam)}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => e.key === "Enter" && toggleItem(fam)}
                                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg text-start transition-colors hover:bg-surf2/60"
                                >
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: colorForFamily(fam) }}
                                  />
                                  <EditableFieldValue
                                    value={fam}
                                    className="min-w-0 flex-1 truncate text-muted"
                                    title={t.inlineEdit.renameHint}
                                    onSave={(v) => handleRenameSalesField("item", fam, v.trim())}
                                  />
                                  <span
                                    className={`shrink-0 font-mono ${
                                      fc.pctChange !== null && fc.pctChange < 0 ? "text-red" : "text-green"
                                    }`}
                                  >
                                    {fc.pctChange !== null && fc.pctChange > 0 ? "+" : ""}
                                    {fc.pctChange ?? "—"}
                                    {fc.pctChange !== null ? "%" : ""}
                                  </span>
                                  <span className="shrink-0 text-[10px] text-muted">{itemOpen ? t.common.hide : t.common.details}</span>
                                </div>
                                <div className="ps-4 font-mono text-[11px] break-words text-muted">
                                  {t.common.month(report.comparedToMonth)}:{" "}
                                  <EditableValue
                                    value={fc.prevValue}
                                    formatted={formatNumber(fc.prevValue)}
                                    edited={editedCells.get(JSON.stringify([area, fam, report.comparedToMonth]))}
                                    onSave={(v) => handleEditSalesCell(area, fam, report.comparedToMonth, v)}
                                  />{" "}
                                  →{" "}
                                  {t.common.month(report.latestMonth)}:{" "}
                                  <EditableValue
                                    value={fc.currValue}
                                    formatted={formatNumber(fc.currValue)}
                                    edited={editedCells.get(JSON.stringify([area, fam, report.latestMonth]))}
                                    onSave={(v) => handleEditSalesCell(area, fam, report.latestMonth, v)}
                                  />
                                </div>

                                {itemOpen && renderItemDetail(fam)}
                              </div>
                              );
                            })}
                          </div>
                        </div>
                        );
                      })()}

                      <RepHistoryPanel
                        area={area}
                        datasetId={selectedDatasetId!}
                        year={year}
                        assignments={areaAssignments}
                        onChanged={() => selectedDatasetId && fetchAssignments(selectedDatasetId, year)}
                      />

                      {linkedContext.length > 0 && (
                        <div>
                          <div className="mb-2 text-xs font-semibold text-white">{t.linkedFiles.linkedContextTitle}</div>
                          <div className="space-y-2">
                            {linkedContext.map(({ file, records }) => (
                              <div key={file.id} className="rounded-lg bg-surf2/60 p-3 text-xs">
                                <div className="mb-1 flex items-center gap-1.5">
                                  <span className="shrink-0 rounded-full border border-bdr px-1.5 py-0.5 text-[10px] text-muted">
                                    {{ achievement: t.linkedFiles.typeAchievement, kpis: t.linkedFiles.typeKpis, other: t.linkedFiles.typeOther }[file.fileType]}
                                  </span>
                                  <span className="font-semibold text-white" dir="auto">{file.displayName}</span>
                                </div>
                                {records.map((r) => (
                                  <div key={r.id} className="ps-1 text-muted">
                                    {Object.entries(r.data).map(([k, v]) => (
                                      <div key={k} dir="auto">
                                        <span className="text-white">{k}:</span>{" "}
                                        <EditableFieldValue
                                          value={v}
                                          edited={r.isEdited && r.editedAt ? { editedBy: r.editedBy, editedAt: r.editedAt } : undefined}
                                          onSave={(newValue) => handleEditLinkedField(r.id, k, newValue)}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {areaFindings.map((f, i) => (
                        <div key={i} className="break-words rounded-lg bg-surf2 px-3 py-2.5">
                          <p className="mb-1.5">{findingSummary(f, report, t)}</p>
                          {"rootCauseFamily" in f && (
                            <p className="mb-1.5 text-xs text-muted">
                              {t.dashboard.rootCauseItem}{" "}
                              <span className="font-semibold" style={{ color: colorForFamily(f.rootCauseFamily) }}>
                                {f.rootCauseFamily}
                              </span>
                              {" · "}
                              {f.rootCauseDetail.pctChange}% ({t.dashboard.valueDrop(formatNumber(f.rootCauseDetail.absDrop))})
                            </p>
                          )}
                          <p className="text-xs">
                            <span className="font-semibold text-amber">{t.dashboard.decision} </span>
                            {findingDecision(f, t)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      </>
      )}
      </div>
      </main>
    </div>
  );
}
