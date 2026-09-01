"use client";

import { useEffect, useRef, useState } from "react";
import {
  readWorkbookSheet,
  applyColumnMapping,
  applyTargetMapping,
  type ColumnMapping,
  type Dataset,
  type RawSheet,
  type TargetColumnMapping,
} from "@/lib/lumen/columnMapping";
import type { Finding, Report } from "@/lib/lumen/engine";
import { StatTile, AreaChangeBars, FamilyChangeBars, RepLeaderboard } from "./charts";
import { TrendChart } from "./TrendChart";
import { ItemTrendChart } from "./ItemTrendChart";
import { colorForFamily } from "@/lib/lumen/familyColors";
import Sidebar from "@/components/Sidebar";
import { UploadWizardModal, type WizardChoice } from "./UploadWizardModal";
import { UploadTargetsModal } from "./UploadTargetsModal";
import { RepHistoryPanel } from "./RepHistoryPanel";
import { repResponsibleInMonth, type RepAssignment } from "@/lib/lumen/repAssignments";
import { LinkedFilesPanel } from "./LinkedFilesPanel";
import { AddLinkedFileModal, type LinkedFileSave } from "./AddLinkedFileModal";
import { applyLinkedMapping, recordsForAreaMonth, type JoinKey, type LinkedFile, type LinkedRecord } from "@/lib/lumen/linkedFiles";
import { FlagIssueModal } from "./FlagIssueModal";
import { CorrectionLogModal } from "./CorrectionLogModal";
import { EditSalesMappingModal } from "./EditSalesMappingModal";
import type { Correction, DataEdit, IssueType } from "@/lib/lumen/corrections";
import { EditableValue, EditableFieldValue } from "./EditableValue";
import { ExportModal, type ExportFormat } from "./ExportModal";
import { buildExportItems } from "@/lib/lumen/exportItems";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { findingSummary, findingDecision } from "@/lib/i18n/findingText";
import type { Translations } from "@/lib/i18n/translations";

function areaCardId(area: string): string {
  return `area-card-${encodeURIComponent(area)}`;
}

const UPLOAD_BATCH_SIZE = 1000;

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
}: {
  userEmail: string;
  userId: string;
  initialYear: number;
  initialDatasets: Dataset[];
  initialDatasetId: string | null;
  initialReport: Report;
}) {
  const { t, lang } = useLanguage();
  const [year, setYear] = useState(initialYear);
  const [datasets, setDatasets] = useState<Dataset[]>(initialDatasets);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(initialDatasetId);
  const [report, setReport] = useState<Report | null>(initialReport);
  const [loadingReport, setLoadingReport] = useState(false);
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
  const [assignments, setAssignments] = useState<RepAssignment[]>([]);
  const [linkedFiles, setLinkedFiles] = useState<LinkedFile[]>([]);
  const [linkedRecords, setLinkedRecords] = useState<LinkedRecord[]>([]);
  const [pendingLinkedFile, setPendingLinkedFile] = useState<{ file: File; sheet: RawSheet } | null>(null);
  const [replacingLinkedFileId, setReplacingLinkedFileId] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [dataEdits, setDataEdits] = useState<DataEdit[]>([]);
  const [editedCells, setEditedCells] = useState<Map<string, { editedBy: string | null; editedAt: string }>>(new Map());
  const [flagTarget, setFlagTarget] = useState<string | null>(null);
  const [showCorrectionLog, setShowCorrectionLog] = useState(false);
  const [showEditSalesMapping, setShowEditSalesMapping] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetsFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialDatasetId) {
      fetchAssignments(initialDatasetId, initialYear);
      fetchLinkedFiles(initialDatasetId);
      fetchLinkedRecords(initialDatasetId, initialYear);
      fetchCorrections(initialDatasetId);
      fetchDataEdits(initialDatasetId);
    }
    // Only on mount — subsequent dataset/year changes go through fetchReport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAssignments(datasetId: string, y: number) {
    try {
      const res = await fetch(`/api/lumen/rep-assignments?year=${y}&datasetId=${datasetId}`);
      const json = await res.json();
      setAssignments(res.ok ? (json.assignments ?? []) : []);
    } catch {
      setAssignments([]);
    }
  }

  async function fetchLinkedFiles(datasetId: string) {
    try {
      const res = await fetch(`/api/lumen/dataset-files?datasetId=${datasetId}`);
      const json = await res.json();
      setLinkedFiles(res.ok ? (json.files ?? []) : []);
    } catch {
      setLinkedFiles([]);
    }
  }

  async function fetchLinkedRecords(datasetId: string, y: number) {
    try {
      const res = await fetch(`/api/lumen/dataset-records?year=${y}&datasetId=${datasetId}`);
      const json = await res.json();
      setLinkedRecords(res.ok ? (json.records ?? []) : []);
    } catch {
      setLinkedRecords([]);
    }
  }

  async function fetchCorrections(datasetId: string) {
    try {
      const res = await fetch(`/api/lumen/corrections?datasetId=${datasetId}`);
      const json = await res.json();
      setCorrections(res.ok ? (json.corrections ?? []) : []);
    } catch {
      setCorrections([]);
    }
  }

  async function fetchDataEdits(datasetId: string) {
    try {
      const res = await fetch(`/api/lumen/data-edits?datasetId=${datasetId}`);
      const json = await res.json();
      setDataEdits(res.ok ? (json.edits ?? []) : []);
    } catch {
      setDataEdits([]);
    }
  }

  async function fetchReport(datasetId: string, y: number) {
    setLoadingReport(true);
    try {
      const res = await fetch(`/api/lumen/analyze?year=${y}&datasetId=${datasetId}`);
      const json = await res.json();
      setReport(json);
      const cells = new Map<string, { editedBy: string | null; editedAt: string }>();
      for (const c of json.editedCells ?? []) {
        cells.set(c.key, { editedBy: c.editedBy, editedAt: c.editedAt });
      }
      setEditedCells(cells);
    } catch {
      setReport({ error: t.dashboard.couldNotLoad });
    } finally {
      setLoadingReport(false);
    }
    fetchAssignments(datasetId, y);
    fetchLinkedFiles(datasetId);
    fetchLinkedRecords(datasetId, y);
    fetchCorrections(datasetId);
    fetchDataEdits(datasetId);
  }

  function selectDataset(datasetId: string) {
    setSelectedDatasetId(datasetId);
    setExpanded(new Set());
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
      const rows = applyTargetMapping(sheet, mapping);

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
  ): Promise<number | false> {
    const rows = applyColumnMapping(sheet, mapping);
    const monthsInFile = Array.from(new Set(rows.map((r) => r.month))).sort((a, b) => a - b);

    const overlapRes = await fetch(
      `/api/lumen/check-overlap?year=${year}&datasetId=${datasetId}&months=${monthsInFile.join(",")}`,
    );
    const overlapJson = await overlapRes.json();
    if (!overlapRes.ok) throw new Error(overlapJson.error || "Could not check for existing months");

    const overlappingMonths: number[] = overlapJson.overlappingMonths ?? [];
    if (overlappingMonths.length > 0) {
      const proceed = window.confirm(
        `${fileLabel} — month(s) ${overlappingMonths.join(", ")} already have data in this dataset for ${year}. ` +
          `Continuing will delete the existing rows for those months and replace them with ` +
          `this file. This cannot be undone. Continue?`,
      );
      if (!proceed) return false;

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
    for (let i = 0; i < batches.length; i++) {
      setUploadProgress(`${fileLabel}: batch ${i + 1} of ${batches.length}…`);
      const res = await fetch("/api/lumen/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, datasetId, sourceFile: fileName, rows: batches[i] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      inserted += json.inserted;
    }

    return inserted;
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

      for (let i = 0; i < files.length; i++) {
        const { file, sheet } = files[i];
        const fileLabel = files.length > 1 ? `${file.name} (${i + 1}/${files.length})` : file.name;
        try {
          const inserted = await uploadRowsToDataset(datasetId, mapping, sheet, file.name, fileLabel);
          if (inserted !== false) {
            successCount++;
            totalInserted += inserted;
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

  async function handleAddLinkedFile(file: File) {
    setUploadError(null);
    setUploadMessage(null);
    setReplacingLinkedFileId(null);
    try {
      const sheet = await readWorkbookSheet(file);
      setPendingLinkedFile({ file, sheet });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  async function handleReplaceLinkedFile(fileId: string, file: File) {
    setUploadError(null);
    setUploadMessage(null);
    setReplacingLinkedFileId(fileId);
    try {
      const sheet = await readWorkbookSheet(file);
      setPendingLinkedFile({ file, sheet });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  async function handleLinkedFileConfirm(save: LinkedFileSave) {
    const pending = pendingLinkedFile;
    const replaceId = replacingLinkedFileId;
    setPendingLinkedFile(null);
    setReplacingLinkedFileId(null);
    if (!pending || !selectedDatasetId) return;

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    try {
      const rows = applyLinkedMapping(pending.sheet, save.mapping);

      let fileId: string;
      if (replaceId) {
        const replaceRes = await fetch(`/api/lumen/dataset-files/${replaceId}/replace`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: save.displayName, columnMapping: save.mapping, joinKeys: save.joinKeys }),
        });
        const replaceJson = await replaceRes.json();
        if (!replaceRes.ok) throw new Error(replaceJson.error || "Could not replace the file");
        fileId = replaceId;
      } else {
        const createRes = await fetch("/api/lumen/dataset-files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            datasetId: selectedDatasetId,
            fileType: save.fileType,
            displayName: save.displayName,
            sourceFile: pending.file.name,
            columnMapping: save.mapping,
            joinKeys: save.joinKeys,
          }),
        });
        const createJson = await createRes.json();
        if (!createRes.ok) throw new Error(createJson.error || "Could not create the linked file");
        fileId = createJson.file.id;
      }

      const batches = [];
      for (let i = 0; i < rows.length; i += UPLOAD_BATCH_SIZE) {
        batches.push(rows.slice(i, i + UPLOAD_BATCH_SIZE));
      }

      let inserted = 0;
      for (let i = 0; i < batches.length; i++) {
        setUploadProgress(`Uploading batch ${i + 1} of ${batches.length}…`);
        const res = await fetch(`/api/lumen/dataset-files/${fileId}/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ datasetId: selectedDatasetId, year, rows: batches[i] }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Upload failed");
        inserted += json.inserted;
      }

      setUploadMessage(t.linkedFiles.uploadSuccess(inserted));
      await fetchLinkedFiles(selectedDatasetId);
      await fetchLinkedRecords(selectedDatasetId, year);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleDeleteLinkedFile(file: LinkedFile) {
    const proceed = window.confirm(t.linkedFiles.deleteConfirm(file.displayName));
    if (!proceed || !selectedDatasetId) return;

    try {
      const res = await fetch(`/api/lumen/dataset-files/${file.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not delete the file");
      await fetchLinkedFiles(selectedDatasetId);
      await fetchLinkedRecords(selectedDatasetId, year);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not delete the file");
    }
  }

  async function handleEditJoinKeys(fileId: string, joinKeys: JoinKey[]) {
    if (!selectedDatasetId) return;
    try {
      const res = await fetch(`/api/lumen/dataset-files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinKeys }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update the link");
      await fetchLinkedFiles(selectedDatasetId);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not update the link");
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

  async function handleEditSalesCell(area: string, family: string, month: number, newValue: number) {
    if (!selectedDatasetId) return;
    try {
      const res = await fetch("/api/lumen/sales-records/cell", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: selectedDatasetId, year, month, area, family, newValue }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t.inlineEdit.saveFailed);
      await fetchReport(selectedDatasetId, year);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t.inlineEdit.saveFailed);
    }
  }

  async function handleEditLinkedField(recordId: string, key: string, newValue: string) {
    if (!selectedDatasetId) return;
    try {
      const res = await fetch(`/api/lumen/dataset-records/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, newValue }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t.inlineEdit.saveFailed);
      await fetchLinkedRecords(selectedDatasetId, year);
      await fetchDataEdits(selectedDatasetId);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t.inlineEdit.saveFailed);
    }
  }

  function openFlagModal(label: string) {
    setFlagTarget(label);
  }

  async function handleFlagSubmit(issueType: IssueType, comment: string) {
    if (!selectedDatasetId || !flagTarget) return;
    try {
      const res = await fetch("/api/lumen/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: selectedDatasetId, issueType, targetLabel: flagTarget, comment }),
      });
      if (res.ok) {
        setUploadMessage(t.corrections.submitSuccess);
        await fetchCorrections(selectedDatasetId);
      }
    } finally {
      setFlagTarget(null);
    }
  }

  async function handleToggleCorrectionStatus(correction: Correction) {
    if (!selectedDatasetId) return;
    const nextStatus = correction.status === "open" ? "resolved" : "open";
    try {
      const res = await fetch(`/api/lumen/corrections/${correction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) await fetchCorrections(selectedDatasetId);
    } catch {
      // best-effort; the log simply keeps its previous state if this fails
    }
  }

  async function handleExport(format: ExportFormat, selectedIds: Set<string>) {
    if (!report || "error" in report) return;
    const dataset = datasets.find((d) => d.id === selectedDatasetId);
    const openCount = corrections.filter((c) => c.status === "open").length;

    setExporting(true);
    try {
      const ctx = {
        report,
        t,
        lang,
        datasetName: dataset?.name ?? "Lumen",
        openCorrectionsCount: openCount,
        selectedIds,
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

  function findingsForItem(item: string): { areas: string[]; clusters: string[] } {
    const areasForItem: string[] = [];
    const clustersForItem: string[] = [];
    if (!report || "error" in report) return { areas: areasForItem, clusters: clustersForItem };
    for (const f of report.findings) {
      if (f.type === "local_drop" && f.rootCauseFamily === item) areasForItem.push(f.area);
      if (f.type === "systemic_drop" && f.rootCauseFamily === item) clustersForItem.push(f.cluster);
    }
    return { areas: areasForItem, clusters: clustersForItem };
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

  return (
    <div className="flex min-h-screen flex-col bg-bg sm:flex-row">
      <Sidebar userEmail={userEmail}>
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
          </>
        )}

        {uploadError && <p className="mb-2 break-words text-xs text-red">{uploadError}</p>}
        {uploadMessage && <p className="mb-2 break-words text-xs text-green">{uploadMessage}</p>}

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
          onClick={() => selectedDatasetId && fetchReport(selectedDatasetId, year)}
          disabled={loadingReport || !selectedDatasetId}
          className="w-full rounded-lg bg-gradient-to-br from-amber to-[#d68820] px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
        >
          {loadingReport ? t.sidebar.loading : t.sidebar.analyze}
        </button>

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

        {selectedDatasetId && (
          <LinkedFilesPanel
            files={linkedFiles}
            disabled={uploading}
            onAddFile={handleAddLinkedFile}
            onReplaceFile={handleReplaceLinkedFile}
            onDeleteFile={handleDeleteLinkedFile}
            onEditJoinKeys={handleEditJoinKeys}
          />
        )}

        {selectedDatasetId && (
          <button
            onClick={() => setShowCorrectionLog(true)}
            className="mt-4 w-full rounded-lg border border-bdr px-3 py-2 text-xs text-muted transition-colors hover:border-amber hover:text-white"
          >
            {t.corrections.logButton}
            {corrections.filter((c) => c.status === "open").length > 0 && (
              <span className="ms-1.5 rounded-full bg-amber/20 px-1.5 py-0.5 text-[10px] text-amber">
                {corrections.filter((c) => c.status === "open").length}
              </span>
            )}
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

      {flagTarget && (
        <FlagIssueModal
          targetLabel={flagTarget}
          onCancel={() => setFlagTarget(null)}
          onSubmit={handleFlagSubmit}
        />
      )}

      {showCorrectionLog && (
        <CorrectionLogModal
          corrections={corrections}
          dataEdits={dataEdits}
          onToggleStatus={handleToggleCorrectionStatus}
          onClose={() => setShowCorrectionLog(false)}
        />
      )}

      {showEditSalesMapping && selectedDatasetId && (
        <EditSalesMappingModal
          mapping={datasets.find((d) => d.id === selectedDatasetId)!.columnMapping}
          onCancel={() => setShowEditSalesMapping(false)}
          onSave={handleSaveSalesMapping}
        />
      )}

      {showExportModal && report && !("error" in report) && (
        <ExportModal
          groups={buildExportItems(report, t)}
          exporting={exporting}
          onCancel={() => setShowExportModal(false)}
          onExport={handleExport}
        />
      )}

      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-4xl">
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
              onClick={() => setShowExportModal(true)}
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
              value={report.isSystemicDrop ? t.dashboard.clusterWide : findingsByArea.size > 0 ? t.dashboard.localized : t.dashboard.stable}
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

          {systemicFindings.map((f, i) => (
            <div key={i} className="mb-5 rounded-2xl border border-red/40 bg-red/10 p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="break-words text-sm">
                  {report.hasClusters && <span className="font-semibold text-white">{f.cluster}: </span>}
                  {findingSummary(f, report, t)}
                </p>
                <button
                  type="button"
                  onClick={() => openFlagModal(`Systemic drop: ${f.cluster}`)}
                  title={t.corrections.flagButton}
                  className="shrink-0 text-xs text-muted hover:text-amber"
                >
                  🚩
                </button>
              </div>
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
                      <div key={rep} className="text-xs">
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
                                  clusterSeries={report.repAverageSeries}
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
              const clusterSummary = report.clusters[d.cluster];
              const areaClusterSystemic = clusterSummary?.isSystemicDrop ?? false;
              const causeLine =
                areaFindings.length > 0
                  ? findingSummary(areaFindings[0], report, t)
                  : areaClusterSystemic && d.pctChange !== null && d.pctChange <= -15
                    ? t.dashboard.partOfClusterDrop
                    : t.dashboard.noChangeThisMonth;

              const clusterSeries = clusterSummary?.monthlySeries ?? [];
              const clusterLast = clusterSeries[clusterSeries.length - 1];
              const clusterPrev = clusterSeries[clusterSeries.length - 2];
              const clusterPct =
                clusterLast && clusterPrev && clusterPrev.avgValue !== 0
                  ? Math.round(((clusterLast.avgValue - clusterPrev.avgValue) / clusterPrev.avgValue) * 1000) / 10
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
                        <span className="truncate font-medium" dir="auto">{area}</span>
                        {report.hasClusters && (
                          <span className="shrink-0 rounded-full border border-bdr px-1.5 py-0.5 text-[10px] text-muted" dir="auto">
                            {d.cluster}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted">{causeLine}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openFlagModal(`Area: ${area}`);
                        }}
                        title={t.corrections.flagButton}
                        className="text-xs text-muted hover:text-amber"
                      >
                        🚩
                      </button>
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
                        {clusterPct !== null && (
                          <p className="mb-2 text-xs text-muted">
                            {t.dashboard.areaMovedVs(
                              d.pctChange ?? 0,
                              report.hasClusters ? d.cluster : t.dashboard.clusterWord,
                              clusterPct,
                            )}
                          </p>
                        )}
                        {responsibleInLatest && (
                          <p className="mb-2 text-xs text-muted" dir="auto">
                            {t.repHistory.responsibleInMonth(
                              t.common.month(report.latestMonth),
                              responsibleInLatest.rep ?? t.repHistory.vacant,
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
                        <p className="mt-1.5 text-xs text-muted">{t.dashboard.valueExplainer}</p>
                      </div>

                      {d.monthlySeries.length >= 2 && (
                        <div>
                          <div className="mb-2 text-xs font-semibold text-white">
                            {t.dashboard.trendLastMonths(d.monthlySeries.length)}
                          </div>
                          <TrendChart
                            areaLabel={area}
                            areaSeries={d.monthlySeries}
                            clusterSeries={clusterSeries}
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
                              const itemSeries = report.itemMonthlySeries[fam] ?? [];
                              const areaRanking = Object.entries(report.areaFamilyChanges)
                                .map(([a, changes]) => [a, changes[fam]] as const)
                                .filter((entry): entry is [string, (typeof report.areaFamilyChanges)[string][string]] => entry[1] !== undefined)
                                .sort((a, b) => b[1].currValue - a[1].currValue);
                              const { areas: rootCauseAreas, clusters: rootCauseClusters } = findingsForItem(fam);

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
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openFlagModal(`Item: ${fam} (${area})`);
                                    }}
                                    title={t.corrections.flagButton}
                                    className="shrink-0 text-[10px] text-muted hover:text-amber"
                                  >
                                    🚩
                                  </button>
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

                                {itemOpen && (
                                  <div className="ms-4 mt-2 space-y-3 rounded-lg bg-surf2/60 p-3">
                                    {itemSeries.length >= 2 && (
                                      <div>
                                        <div className="mb-1 text-[11px] font-semibold text-white">
                                          {t.dashboard.trendLastMonths(itemSeries.length)}
                                        </div>
                                        <ItemTrendChart label={fam} series={itemSeries} />
                                      </div>
                                    )}

                                    {areaRanking.length > 0 && (
                                      <div>
                                        <div className="mb-1 text-[11px] font-semibold text-white">
                                          {t.dashboard.byAreaMonth(report.latestMonth)}
                                        </div>
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
                                              <span className="shrink-0 font-mono text-white">
                                                {formatNumber(changes.currValue)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {(rootCauseAreas.length > 0 || rootCauseClusters.length > 0) && (
                                      <div className="text-[11px] text-muted">
                                        <span className="font-semibold text-amber">{t.dashboard.rootCauseFor} </span>
                                        {[
                                          ...rootCauseAreas,
                                          ...rootCauseClusters.map((c) =>
                                            c === "All areas" ? t.dashboard.theClusterWideDrop : t.dashboard.theClusterWideDropIn(c),
                                          ),
                                        ].join(", ")}
                                      </div>
                                    )}
                                  </div>
                                )}
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
                          <div className="mb-1.5 flex items-start justify-between gap-2">
                            <p>{findingSummary(f, report, t)}</p>
                            <button
                              type="button"
                              onClick={() => openFlagModal(`Decision: ${area} — ${findingDecision(f, t)}`)}
                              title={t.corrections.flagButton}
                              className="shrink-0 text-xs text-muted hover:text-amber"
                            >
                              🚩
                            </button>
                          </div>
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
      </div>
      </main>
    </div>
  );
}
