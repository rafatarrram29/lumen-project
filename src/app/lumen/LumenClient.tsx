"use client";

import { useRef, useState } from "react";
import { readWorkbookSheet, applyColumnMapping, type ColumnMapping, type Dataset, type RawSheet } from "@/lib/lumen/columnMapping";
import type { Finding, Report } from "@/lib/lumen/engine";
import { StatTile, AreaChangeBars, FamilyChangeBars } from "./charts";
import { TrendChart } from "./TrendChart";
import { ItemTrendChart } from "./ItemTrendChart";
import { colorForFamily } from "@/lib/lumen/familyColors";
import Sidebar from "@/components/Sidebar";
import { UploadWizardModal, type WizardChoice } from "./UploadWizardModal";

function areaCardId(area: string): string {
  return `area-card-${encodeURIComponent(area)}`;
}

const UPLOAD_BATCH_SIZE = 1000;

function formatNumber(n: number): string {
  return n.toLocaleString();
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

export default function LumenClient({
  userEmail,
  initialYear,
  initialDatasets,
  initialDatasetId,
  initialReport,
}: {
  userEmail: string;
  initialYear: number;
  initialDatasets: Dataset[];
  initialDatasetId: string | null;
  initialReport: Report;
}) {
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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingSheet, setPendingSheet] = useState<RawSheet | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchReport(datasetId: string, y: number) {
    setLoadingReport(true);
    try {
      const res = await fetch(`/api/lumen/analyze?year=${y}&datasetId=${datasetId}`);
      const json = await res.json();
      setReport(json);
    } catch {
      setReport({ error: "Could not load the report." });
    } finally {
      setLoadingReport(false);
    }
  }

  function selectDataset(datasetId: string) {
    setSelectedDatasetId(datasetId);
    setExpanded(new Set());
    fetchReport(datasetId, year);
  }

  async function handleFileSelected(file: File) {
    setUploadError(null);
    setUploadMessage(null);
    try {
      const sheet = await readWorkbookSheet(file);
      setPendingFile(file);
      setPendingSheet(sheet);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  async function uploadRowsToDataset(
    datasetId: string,
    mapping: ColumnMapping,
    sheet: RawSheet,
    fileName: string,
  ) {
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
        `Month(s) ${overlappingMonths.join(", ")} already have data in this dataset for ${year}. ` +
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
      setUploadProgress(`Uploading batch ${i + 1} of ${batches.length}…`);
      const res = await fetch("/api/lumen/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, datasetId, sourceFile: fileName, rows: batches[i] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      inserted += json.inserted;
    }

    setUploadMessage(`Uploaded and processed ${fileName} (${formatNumber(inserted)} rows).`);
    return true;
  }

  async function handleWizardConfirm(choice: WizardChoice) {
    const file = pendingFile;
    const sheet = pendingSheet;
    setPendingFile(null);
    setPendingSheet(null);
    if (!file || !sheet) return;

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

      const uploaded = await uploadRowsToDataset(datasetId, mapping, sheet, file.name);
      if (uploaded) {
        setSelectedDatasetId(datasetId);
        setExpanded(new Set());
        await fetchReport(datasetId, year);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
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
          accept=".xls,.xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelected(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mb-2 w-full rounded-lg border border-dashed border-bdr px-3 py-2.5 text-sm text-muted transition-colors hover:border-amber hover:text-white disabled:opacity-60"
        >
          {uploading ? uploadProgress ?? "Uploading…" : "+ Upload monthly file"}
        </button>
        {uploadError && <p className="mb-2 break-words text-xs text-red">{uploadError}</p>}
        {uploadMessage && <p className="mb-2 break-words text-xs text-green">{uploadMessage}</p>}

        <label className="mb-2 flex items-center justify-between gap-2 text-sm text-muted">
          Year
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
          {loadingReport ? "Loading…" : "Analyze"}
        </button>

        {datasets.length > 0 && (
          <div className="mt-4 border-t border-bdr pt-4">
            <div className="mb-2 text-xs font-semibold text-muted">Datasets</div>
            <div className="flex flex-col gap-1.5">
              {datasets.map((d) => (
                <button
                  key={d.id}
                  onClick={() => selectDataset(d.id)}
                  title={d.name}
                  className={`w-full min-w-0 truncate rounded-lg border px-3 py-1.5 text-left text-sm transition-colors ${
                    d.id === selectedDatasetId
                      ? "border-amber bg-amber/10 text-white"
                      : "border-bdr text-muted hover:text-white"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </Sidebar>

      {pendingFile && pendingSheet && (
        <UploadWizardModal
          fileName={pendingFile.name}
          sheet={pendingSheet}
          datasets={datasets}
          defaultDatasetId={selectedDatasetId}
          onCancel={() => {
            setPendingFile(null);
            setPendingSheet(null);
          }}
          onConfirm={handleWizardConfirm}
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
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Areas analyzed" value={String(areas.length)} delayMs={0} />
            <StatTile
              label="In decline"
              value={String(areas.filter(([, d]) => d.pctChange !== null && d.pctChange < 0).length)}
              tone="red"
              delayMs={60}
            />
            <StatTile
              label="Pattern"
              value={report.isSystemicDrop ? "Cluster-wide" : findingsByArea.size > 0 ? "Localized" : "Stable"}
              tone={report.isSystemicDrop ? "red" : findingsByArea.size > 0 ? "amber" : "green"}
              delayMs={120}
            />
            <StatTile label="Decisions raised" value={String(report.findings.length)} tone="amber" delayMs={180} />
          </div>

          <div className="mb-4 text-sm text-muted">
            Comparing month <span className="font-mono text-white">{report.comparedToMonth}</span>{" "}
            → <span className="font-mono text-white">{report.latestMonth}</span>
            {" — "}
            {report.isSystemicDrop ? (
              <span className="font-semibold text-red">cluster-wide drop detected</span>
            ) : (
              <span className="text-green">no systemic pattern</span>
            )}
          </div>

          {systemicFindings.map((f, i) => (
            <div key={i} className="mb-5 rounded-2xl border border-red/40 bg-red/10 p-5">
              <p className="mb-2 break-words text-sm">
                {report.hasClusters && <span className="font-semibold text-white">{f.cluster}: </span>}
                {f.summary}
              </p>
              <div className="break-words rounded-lg bg-surf2 px-3 py-2 text-sm">
                <span className="font-semibold text-amber">Decision: </span>
                {f.decision}
              </div>
            </div>
          ))}

          <div className="mb-5">
            <AreaChangeBars areas={areas} onSelectArea={selectArea} />
          </div>

          <div className="mb-5">
            <FamilyChangeBars families={report.familyChanges} />
          </div>

          <h2 className="mb-3 text-sm font-semibold text-white">All areas</h2>
          <div className="space-y-3">
            {areas.map(([area, d]) => {
              const areaFindings = findingsByArea.get(area) ?? [];
              const isOpen = expanded.has(area);
              const clusterSummary = report.clusters[d.cluster];
              const areaClusterSystemic = clusterSummary?.isSystemicDrop ?? false;
              const causeLine =
                areaFindings.length > 0
                  ? areaFindings[0].summary
                  : areaClusterSystemic && d.pctChange !== null && d.pctChange <= -15
                    ? "Part of the cluster-wide drop — see the systemic finding above."
                    : "No significant change this month.";

              const clusterSeries = clusterSummary?.monthlySeries ?? [];
              const clusterLast = clusterSeries[clusterSeries.length - 1];
              const clusterPrev = clusterSeries[clusterSeries.length - 2];
              const clusterPct =
                clusterLast && clusterPrev && clusterPrev.avgValue !== 0
                  ? Math.round(((clusterLast.avgValue - clusterPrev.avgValue) / clusterPrev.avgValue) * 1000) / 10
                  : null;

              return (
                <div
                  key={area}
                  id={areaCardId(area)}
                  className="scroll-mt-4 rounded-2xl border border-bdr bg-surf p-5 transition-colors"
                >
                  <button
                    onClick={() => toggle(area)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{area}</span>
                        {report.hasClusters && (
                          <span className="shrink-0 rounded-full border border-bdr px-1.5 py-0.5 text-[10px] text-muted">
                            {d.cluster}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted">{causeLine}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge pctChange={d.pctChange} />
                      <span className="text-xs text-muted">{isOpen ? "Hide" : "Details"}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-4 space-y-5 border-t border-bdr pt-4 text-sm">
                      <div>
                        <p className="mb-2">
                          Value: Month {report.comparedToMonth}:{" "}
                          <span className="font-mono text-white">{formatNumber(d.prevValue)}</span> → Month{" "}
                          {report.latestMonth}: <span className="font-mono text-white">{formatNumber(d.currValue)}</span>.
                          Quantity: Month {report.comparedToMonth}:{" "}
                          <span className="font-mono text-white">{formatNumber(d.prevQty)}</span> → Month{" "}
                          {report.latestMonth}: <span className="font-mono text-white">{formatNumber(d.currQty)}</span>.
                        </p>
                        {clusterPct !== null && (
                          <p className="mb-2 text-xs text-muted">
                            This area moved{" "}
                            <span className={d.pctChange !== null && d.pctChange < 0 ? "text-red" : "text-green"}>
                              {d.pctChange}%
                            </span>{" "}
                            vs the {report.hasClusters ? `${d.cluster} cluster` : "cluster"} average of{" "}
                            <span className={clusterPct < 0 ? "text-red" : "text-green"}>{clusterPct}%</span> over
                            the same month.
                          </p>
                        )}
                        <table className="w-full text-left">
                          <tbody>
                            <tr className="text-muted">
                              <td className="py-1 pr-4">3-month declining streak</td>
                              <td className="py-1 text-white">{d.decliningStreak ? "Yes" : "No"}</td>
                            </tr>
                          </tbody>
                        </table>
                        <p className="mt-1.5 text-xs text-muted">
                          &quot;Value&quot; is the sum of the mapped Value column from your uploaded file (all
                          items combined, no currency conversion). &quot;Quantity&quot; is the sum of the mapped
                          Quantity column for the same area and month.
                        </p>
                      </div>

                      {d.monthlySeries.length >= 2 && (
                        <div>
                          <div className="mb-2 text-xs font-semibold text-white">
                            Trend — last {d.monthlySeries.length} months
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
                          <div className="mb-2 text-xs font-semibold text-white">By item</div>
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
                                <button
                                  onClick={() => toggleItem(fam)}
                                  className="flex w-full items-center gap-2 rounded-lg text-left transition-colors hover:bg-surf2/60"
                                >
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: colorForFamily(fam) }}
                                  />
                                  <span className="min-w-0 flex-1 truncate text-muted">{fam}</span>
                                  <span
                                    className={`shrink-0 font-mono ${
                                      fc.pctChange !== null && fc.pctChange < 0 ? "text-red" : "text-green"
                                    }`}
                                  >
                                    {fc.pctChange !== null && fc.pctChange > 0 ? "+" : ""}
                                    {fc.pctChange ?? "—"}
                                    {fc.pctChange !== null ? "%" : ""}
                                  </span>
                                  <span className="shrink-0 text-[10px] text-muted">{itemOpen ? "Hide" : "Details"}</span>
                                </button>
                                <div className="pl-4 font-mono text-[11px] break-words text-muted">
                                  Month {report.comparedToMonth}: {formatNumber(fc.prevValue)} → Month{" "}
                                  {report.latestMonth}: {formatNumber(fc.currValue)}
                                </div>

                                {itemOpen && (
                                  <div className="ml-4 mt-2 space-y-3 rounded-lg bg-surf2/60 p-3">
                                    {itemSeries.length >= 2 && (
                                      <div>
                                        <div className="mb-1 text-[11px] font-semibold text-white">
                                          Trend — last {itemSeries.length} months
                                        </div>
                                        <ItemTrendChart label={fam} series={itemSeries} />
                                      </div>
                                    )}

                                    {areaRanking.length > 0 && (
                                      <div>
                                        <div className="mb-1 text-[11px] font-semibold text-white">
                                          By area — Month {report.latestMonth}
                                        </div>
                                        <div className="space-y-1">
                                          {areaRanking.map(([a, changes], i) => (
                                            <div key={a} className="flex items-center justify-between gap-2 text-[11px]">
                                              <span className="min-w-0 flex-1 truncate text-muted">
                                                {a}
                                                {i === 0 && areaRanking.length > 1 && (
                                                  <span className="ml-1.5 rounded-full border border-green/40 px-1.5 py-0.5 text-[9px] text-green">
                                                    Top
                                                  </span>
                                                )}
                                                {i === areaRanking.length - 1 && areaRanking.length > 1 && (
                                                  <span className="ml-1.5 rounded-full border border-red/40 px-1.5 py-0.5 text-[9px] text-red">
                                                    Lowest
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
                                        <span className="font-semibold text-amber">Root cause for: </span>
                                        {[
                                          ...rootCauseAreas,
                                          ...rootCauseClusters.map((c) =>
                                            c === "All areas" ? "the cluster-wide drop" : `the cluster-wide drop in ${c}`,
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

                      {areaFindings.map((f, i) => (
                        <div key={i} className="break-words rounded-lg bg-surf2 px-3 py-2.5">
                          <p className="mb-1.5">{f.summary}</p>
                          {"rootCauseFamily" in f && (
                            <p className="mb-1.5 text-xs text-muted">
                              Root cause item:{" "}
                              <span className="font-semibold" style={{ color: colorForFamily(f.rootCauseFamily) }}>
                                {f.rootCauseFamily}
                              </span>
                              {" · "}
                              {f.rootCauseDetail.pctChange}% ({formatNumber(f.rootCauseDetail.absDrop)} value drop)
                            </p>
                          )}
                          <p className="text-xs">
                            <span className="font-semibold text-amber">Decision: </span>
                            {f.decision}
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
