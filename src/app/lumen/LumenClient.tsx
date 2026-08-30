"use client";

import { useRef, useState } from "react";
import { parseSalesFile } from "@/lib/lumen/parseSalesFile";
import type { Finding, Report } from "@/lib/lumen/engine";
import { StatTile, AreaChangeBars, FamilyChangeBars } from "./charts";
import { TrendChart } from "./TrendChart";
import { colorForFamily } from "@/lib/lumen/familyColors";
import Sidebar from "@/components/Sidebar";

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
  initialReport,
}: {
  userEmail: string;
  initialYear: number;
  initialReport: Report;
}) {
  const [year, setYear] = useState(initialYear);
  const [report, setReport] = useState<Report | null>(initialReport);
  const [loadingReport, setLoadingReport] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchReport(y: number) {
    setLoadingReport(true);
    try {
      const res = await fetch(`/api/lumen/analyze?year=${y}`);
      const json = await res.json();
      setReport(json);
    } catch {
      setReport({ error: "Could not load the report." });
    } finally {
      setLoadingReport(false);
    }
  }

  async function handleFile(file: File) {
    setUploadError(null);
    setUploadMessage(null);
    setUploading(true);

    try {
      const rows = await parseSalesFile(file);
      const monthsInFile = Array.from(new Set(rows.map((r) => r.month))).sort((a, b) => a - b);

      const overlapRes = await fetch(
        `/api/lumen/check-overlap?year=${year}&months=${monthsInFile.join(",")}`,
      );
      const overlapJson = await overlapRes.json();
      if (!overlapRes.ok) throw new Error(overlapJson.error || "Could not check for existing months");

      const overlappingMonths: number[] = overlapJson.overlappingMonths ?? [];
      if (overlappingMonths.length > 0) {
        const proceed = window.confirm(
          `Month(s) ${overlappingMonths.join(", ")} already have data for ${year}. ` +
            `Continuing will delete the existing rows for those months and replace them with ` +
            `this file. This cannot be undone. Continue?`,
        );
        if (!proceed) {
          setUploading(false);
          return;
        }

        const replaceRes = await fetch("/api/lumen/replace-months", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year, months: overlappingMonths }),
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
          body: JSON.stringify({ year, sourceFile: file.name, rows: batches[i] }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Upload failed");
        inserted += json.inserted;
      }

      setUploadMessage(`Uploaded and processed ${file.name} (${formatNumber(inserted)} rows).`);
      await fetchReport(year);
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

  const systemicFinding =
    report && !hasError ? report.findings.find((f) => f.type === "systemic_drop") : undefined;

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
            if (file) handleFile(file);
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
        {uploadError && <p className="mb-2 text-xs text-red">{uploadError}</p>}
        {uploadMessage && <p className="mb-2 text-xs text-green">{uploadMessage}</p>}

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
          onClick={() => fetchReport(year)}
          disabled={loadingReport}
          className="w-full rounded-lg bg-gradient-to-br from-amber to-[#d68820] px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
        >
          {loadingReport ? "Loading…" : "Analyze"}
        </button>
      </Sidebar>

      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-4xl">
      {hasError && (
        <div className="rounded-2xl border border-bdr bg-surf p-5 text-sm text-muted">
          {report && "error" in report ? report.error : null}
        </div>
      )}

      {report && !hasError && (
        <div key={`${report.year}-${report.comparedToMonth}-${report.latestMonth}-${areas.length}`}>
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

          {systemicFinding && systemicFinding.type === "systemic_drop" && (
            <div className="mb-5 rounded-2xl border border-red/40 bg-red/10 p-5">
              <p className="mb-2 break-words text-sm">{systemicFinding.summary}</p>
              <div className="break-words rounded-lg bg-surf2 px-3 py-2 text-sm">
                <span className="font-semibold text-amber">Decision: </span>
                {systemicFinding.decision}
              </div>
            </div>
          )}

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
              const causeLine =
                areaFindings.length > 0
                  ? areaFindings[0].summary
                  : report.isSystemicDrop && d.pctChange !== null && d.pctChange <= -15
                    ? "Part of the cluster-wide drop — see the systemic finding above."
                    : "No significant change this month.";

              const clusterLast = report.clusterMonthlySeries[report.clusterMonthlySeries.length - 1];
              const clusterPrev = report.clusterMonthlySeries[report.clusterMonthlySeries.length - 2];
              const clusterPct =
                clusterPrev && clusterPrev.avgValue !== 0
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
                      <div className="truncate font-medium">{area}</div>
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
                          Sales value: <span className="font-mono text-white">{formatNumber(d.prevValue)}</span>{" "}
                          (previous month) →{" "}
                          <span className="font-mono text-white">{formatNumber(d.currValue)}</span> (this month).
                          Units sold: <span className="font-mono text-white">{formatNumber(d.prevQty)}</span> →{" "}
                          <span className="font-mono text-white">{formatNumber(d.currQty)}</span>.
                        </p>
                        {clusterPct !== null && (
                          <p className="mb-2 text-xs text-muted">
                            This area moved{" "}
                            <span className={d.pctChange !== null && d.pctChange < 0 ? "text-red" : "text-green"}>
                              {d.pctChange}%
                            </span>{" "}
                            vs the cluster average of{" "}
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
                          &quot;Sales value&quot; is the sum of the Sales Value column from your uploaded
                          file (all products combined, no currency conversion). &quot;Units sold&quot; is
                          the sum of the Sales Qty column for the same area and month.
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
                            clusterSeries={report.clusterMonthlySeries}
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
                          <div className="mb-2 text-xs font-semibold text-white">By product family</div>
                          <div className="space-y-2">
                            {familyEntries.map(([fam, fc]) => (
                              <div key={fam} className="text-xs">
                                <div className="flex items-center gap-2">
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
                                </div>
                                <div className="pl-4 font-mono text-[11px] break-words text-muted">
                                  {formatNumber(fc.prevValue)} → {formatNumber(fc.currValue)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        );
                      })()}

                      {areaFindings.map((f, i) => (
                        <div key={i} className="break-words rounded-lg bg-surf2 px-3 py-2.5">
                          <p className="mb-1.5">{f.summary}</p>
                          {"rootCauseFamily" in f && (
                            <p className="mb-1.5 text-xs text-muted">
                              Root cause family:{" "}
                              <span className="font-semibold" style={{ color: colorForFamily(f.rootCauseFamily) }}>
                                {f.rootCauseFamily}
                              </span>
                              {" · "}
                              {f.rootCauseDetail.pctChange}% ({formatNumber(f.rootCauseDetail.absDrop)} sales
                              value drop)
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
