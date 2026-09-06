"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Dataset } from "@/lib/lumen/columnMapping";
import type { Finding, Report } from "@/lib/lumen/engine";
import type { EditedCell } from "@/lib/lumen/loadReport";
import { StatTile, AreaChangeBars, FamilyChangeBars, RepLeaderboard } from "./charts";
import { colorForFamily } from "@/lib/lumen/familyColors";
import { DashboardSidebar } from "./DashboardSidebar";
import { UploadWizardModal } from "./UploadWizardModal";
import { UploadTargetsModal } from "./UploadTargetsModal";
import { buildOrgChart, knownReps, scopedAreaRanking, type AreaScope } from "@/lib/lumen/orgStructure";
import { AssignAreasModal } from "./AssignAreasModal";
import { AssignManagersModal } from "./AssignManagersModal";
import { ManagerCards } from "./ManagerCards";
import { AddLinkedFileModal } from "./AddLinkedFileModal";
import { CorrectionLogModal } from "./CorrectionLogModal";
import { EditSalesMappingModal } from "./EditSalesMappingModal";
import { UndoToast } from "./UndoToast";
import { ExportModal, type ExportFormat } from "./ExportModal";
import { buildExportItems } from "@/lib/lumen/exportItems";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { findingSummary, findingDecision } from "@/lib/i18n/findingText";
import { AddImsFileModal } from "./AddImsFileModal";
import { imsGroupLabel } from "@/lib/lumen/imsLabels";
import { GlobalSearch } from "./GlobalSearch";
import { useLumenData } from "./useLumenData";
import { areaCardId, itemCardId, repCardId, formatNumber, BreakdownRow, TargetChip } from "./dashboardBits";
import { AreaDetail } from "./AreaDetail";
import { UNDO_WINDOW_MS, type UploadStatus } from "./uploadShared";
import { useLinkedFileUploads } from "./useLinkedFileUploads";
import { useImsFileUploads } from "./useImsFileUploads";
import { useSalesUploads } from "./useSalesUploads";

// recharts is a heavy dependency only ever needed once a trend chart is
// actually shown (an area or item card expanded, or the Market Insights
// tab). Dynamic import keeps it out of the module graph the page evaluates
// on load.
const TrendChart = dynamic(() => import("./TrendChart").then((m) => m.TrendChart), { ssr: false });
const ItemTrendChart = dynamic(() => import("./ItemTrendChart").then((m) => m.ItemTrendChart), { ssr: false });
// ImsPanel was imported statically, which dragged ImsTrendChart and with it
// recharts into the eager bundle — quietly cancelling the two splits above.
const ImsPanel = dynamic(() => import("./ImsPanel").then((m) => m.ImsPanel), { ssr: false });

type LastEdit =
  | { kind: "sales"; area: string; family: string; month: number; oldValue: number; newValue: number }
  | { kind: "linked"; recordId: string; key: string; oldValue: unknown; newValue: unknown }
  | { kind: "rename"; field: "area" | "item"; oldValue: string; newValue: string }
  | { kind: "imsRename"; field: "area" | "product" | "company"; oldValue: string; newValue: string };

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
    pendingFiles,
    pendingTargets,
    cancelPendingFiles,
    cancelPendingTargets,
    handleFilesSelected,
    handleTargetsFileSelected,
    handleTargetsConfirm,
    handleWizardConfirm,
    handleSaveSalesMapping,
  } = useSalesUploads({
    datasetId: selectedDatasetId,
    year,
    datasets,
    setDatasets,
    t,
    status: uploadStatus,
    fetchReport,
    onDatasetSwitched: (id) => {
      setSelectedDatasetId(id);
      setExpanded(new Set());
    },
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
  /**
   * An item's drill-down. `scope` narrows it to one part of the org chart —
   * a rep's areas, or a manager's team — so opening an item under a rep who
   * covers three governorates lists those three, not every area in the
   * dataset.
   */
  function renderItemDetail(item: string, scope?: AreaScope | null) {
    if (!report || "error" in report) return null;
    // Scoped, the series comes from the areas in scope (fetched for exactly
    // those); unscoped it is the item across the whole dataset.
    const itemSeries = scope ? (scope.itemSeries[item] ?? []) : (report.itemMonthlySeries[item] ?? []);
    const areaRanking = scopedAreaRanking(report.areaFamilyChanges, item, scope);
    const { areas: rootCauseAreas, lines: rootCauseLines } = findingsForItem(item);
    const scopedUnits = scope ? scope.hasQuantity : showsUnits;
    const scopedUnitLabel = scopedUnits ? t.units.units : t.units.value;

    return (
      <div className="ms-4 mt-2 space-y-3 rounded-lg bg-surf2/60 p-3">
        {itemSeries.length >= 2 && (
          <div>
            <div className="mb-1 text-[11px] font-semibold text-white">
              {t.dashboard.trendLastMonths(itemSeries.length)} —{" "}
              <span className="text-amber">{scopedUnitLabel}</span>
            </div>
            {/* Units where the file has a quantity column, money where it
                doesn't — named either way, because a chart that silently
                switched between the two would be worse than one that only
                ever showed money. */}
            <ItemTrendChart
              label={item}
              series={itemSeries}
              showUnits={scopedUnits}
              unitLabel={scopedUnitLabel}
            />
            {!scopedUnits && (
              <div className="mt-1 text-[10px] text-muted">{t.units.valueNote}</div>
            )}
          </div>
        )}

        {areaRanking.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] font-semibold text-white">
              {t.dashboard.byAreaMonth(report.latestMonth)}
              {/* Say out loud that the list is narrowed. Three rows where
                  the Sales tab shows thirty is otherwise indistinguishable
                  from an item that simply does not sell anywhere else. */}
              {scope && (
                <span className="ms-2 font-normal text-muted" dir="auto">
                  {t.org.scopedToAreas(areaRanking.length, scope.label)}
                </span>
              )}
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

  /**
   * The full area card. The Sales list maps over this, and a district
   * manager's drill-down calls it for whichever area was tapped — so the
   * card a manager opens IS the Sales card, not a lighter copy of it.
   */
  function renderAreaDetail(area: string, anchored = false, scope?: AreaScope | null) {
    if (!report || hasError) return null;
    const d = report.areas[area];
    // An area with no figures for this year — assigned to a rep, but
    // nothing uploaded for it — has no card to show.
    if (!d) return null;
    return (
      <AreaDetail
        anchored={anchored}
        scope={scope ?? null}
        area={area}
        d={d}
        report={report}
        areaFindings={findingsByArea.get(area) ?? []}
        isOpen={expanded.has(area)}
        toggle={toggle}
        expandedItems={expandedItems}
        toggleItem={toggleItem}
        renderItemDetail={renderItemDetail}
        assignments={assignments}
        managerLinks={managerLinks}
        linkedFiles={linkedFiles}
        linkedRecords={linkedRecords}
        editedCells={editedCells}
        targetThreshold={targetThreshold}
        selectedDatasetId={selectedDatasetId}
        year={year}
        onAssignmentsChanged={() => selectedDatasetId && fetchAssignments(selectedDatasetId, year)}
        handleRenameSalesField={handleRenameSalesField}
        handleEditSalesCell={handleEditSalesCell}
        handleEditLinkedField={handleEditLinkedField}
      />
    );
  }

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
      <DashboardSidebar
        userEmail={userEmail}
        userId={userId}
        t={t}
        activeTab={activeTab}
        uploading={uploading}
        uploadProgress={uploadProgress}
        uploadError={uploadError}
        uploadMessage={uploadMessage}
        loadingReport={loadingReport}
        year={year}
        setYear={setYear}
        datasets={datasets}
        selectedDatasetId={selectedDatasetId}
        linkedFiles={linkedFiles}
        onFilesSelected={handleFilesSelected}
        onTargetsFileSelected={handleTargetsFileSelected}
        onAssignAreas={() => setShowAssignAreas(true)}
        onAssignManagers={() => setShowAssignManagers(true)}
        onAnalyze={() => {
          clearUndo();
          if (selectedDatasetId) fetchReport(selectedDatasetId, year);
        }}
        onSelectDataset={selectDataset}
        onEditMapping={() => setShowEditSalesMapping(true)}
        onDeleteDataset={handleDeleteDataset}
        onShowCorrectionLog={() => setShowCorrectionLog(true)}
        onAddLinkedFile={handleAddLinkedFile}
        onReplaceLinkedFile={handleReplaceLinkedFile}
        onDeleteLinkedFile={handleDeleteLinkedFile}
        onEditJoinKeys={handleEditJoinKeys}
      />

      {pendingFiles.length > 0 && (
        <UploadWizardModal
          fileName={pendingFiles[0].file.name}
          extraFilesCount={pendingFiles.length - 1}
          sheet={pendingFiles[0].sheet}
          datasets={datasets}
          defaultDatasetId={selectedDatasetId}
          onCancel={cancelPendingFiles}
          onConfirm={handleWizardConfirm}
        />
      )}

      {pendingTargets && selectedDatasetId && (
        <UploadTargetsModal
          fileName={pendingTargets.file.name}
          sheet={pendingTargets.sheet}
          dataset={datasets.find((d) => d.id === selectedDatasetId)!}
          onCancel={cancelPendingTargets}
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
          onSave={async (mapping) => {
            if (await handleSaveSalesMapping(mapping)) setShowEditSalesMapping(false);
          }}
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
              renderAreaDetail={(area, scope) => renderAreaDetail(area, false, scope)}
              // Opening an area here expands it in the dashboard's own
              // state, so the card that appears is the expanded card
              // rather than its collapsed header row.
              onAreaOpen={(area) => setExpanded((prev) => new Set(prev).add(area))}
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
                  .map(([fam, fc]) => (
                    <BreakdownRow
                      key={fam}
                      id={itemCardId(fam)}
                      name={fam}
                      pctChange={fc.pctChange}
                      prevValue={fc.prevValue}
                      currValue={fc.currValue}
                      comparedToMonth={report.comparedToMonth}
                      latestMonth={report.latestMonth}
                      isOpen={expandedItems.has(fam)}
                      onToggle={() => toggleItem(fam)}
                      t={t}
                      leading={
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorForFamily(fam) }} />
                      }
                    >
                      {renderItemDetail(fam)}
                    </BreakdownRow>
                  ))}
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
                    const repSeries = report.repMonthlySeries[rep] ?? [];
                    return (
                      <BreakdownRow
                        key={rep}
                        id={repCardId(rep)}
                        name={rep}
                        pctChange={rc.pctChange}
                        prevValue={rc.prevValue}
                        currValue={rc.currValue}
                        comparedToMonth={report.comparedToMonth}
                        latestMonth={report.latestMonth}
                        isOpen={expandedReps.has(rep)}
                        onToggle={() => toggleRep(rep)}
                        t={t}
                        trailing={<TargetChip progress={report.repTargets[rep]} threshold={targetThreshold} t={t} />}
                      >
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
                      </BreakdownRow>
                    );
                  })}
              </div>
            </div>
          )}

          <h2 className="mb-3 text-sm font-semibold text-white">{t.dashboard.allAreas}</h2>
          <div className="space-y-3">
            {/* The one area card, shared with the district-manager
                drill-down — see AreaDetail.tsx. */}
            {areas.map(([area]) => (
              // The canonical card: this is the one global search scrolls to.
              <div key={area}>{renderAreaDetail(area, true)}</div>
            ))}
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
