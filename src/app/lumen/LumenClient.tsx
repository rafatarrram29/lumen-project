"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { parseSalesFile } from "@/lib/lumen/parseSalesFile";
import type { Finding, Report } from "@/lib/lumen/engine";
import { StatTile, AreaChangeBars, FamilyChangeBars } from "./charts";
import { colorForFamily } from "@/lib/lumen/familyColors";

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
      className={`rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${
        positive ? "bg-green/15 text-green" : "bg-red/15 text-red"
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
    <div className="mx-auto min-w-0 w-full max-w-3xl min-h-screen overflow-x-hidden px-4 py-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber to-[#d68820] font-bold text-bg">
            L
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">Lumen — Territory Decision Engine</div>
            <div className="truncate text-xs text-muted">{userEmail}</div>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="self-start rounded-lg border border-bdr px-3 py-2 text-sm text-muted transition-colors hover:border-amber hover:text-white sm:self-auto"
        >
          ← Dashboard
        </Link>
      </div>

      <div className="mb-6 rounded-2xl border border-bdr bg-surf p-5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
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
            className="rounded-lg border border-dashed border-bdr px-3 py-2.5 text-sm text-muted transition-colors hover:border-amber hover:text-white disabled:opacity-60"
          >
            {uploading ? uploadProgress ?? "Uploading…" : "+ Upload monthly file"}
          </button>

          <label className="flex items-center gap-2 text-sm text-muted">
            Year
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24 rounded-lg border border-bdr bg-surf2 px-2 py-1.5 font-mono text-sm text-white outline-none focus:border-amber"
            />
          </label>
          <button
            onClick={() => fetchReport(year)}
            disabled={loadingReport}
            className="rounded-lg bg-gradient-to-br from-amber to-[#d68820] px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
          >
            {loadingReport ? "Loading…" : "Analyze"}
          </button>
        </div>
        {uploadError && <p className="text-sm text-red">{uploadError}</p>}
        {uploadMessage && <p className="text-sm text-green">{uploadMessage}</p>}
      </div>

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
            <AreaChangeBars areas={areas} />
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

              return (
                <div key={area} className="rounded-2xl border border-bdr bg-surf p-4">
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
                    <div className="mt-4 space-y-4 border-t border-bdr pt-4 text-sm">
                      <div>
                        <table className="w-full text-left">
                          <tbody>
                            <tr className="text-muted">
                              <td className="py-1 pr-4">Sales value — previous month</td>
                              <td className="py-1 font-mono text-white">{formatNumber(d.prevValue)}</td>
                            </tr>
                            <tr className="text-muted">
                              <td className="py-1 pr-4">Sales value — current month</td>
                              <td className="py-1 font-mono text-white">{formatNumber(d.currValue)}</td>
                            </tr>
                            <tr className="text-muted">
                              <td className="py-1 pr-4">Units sold — previous month</td>
                              <td className="py-1 font-mono text-white">{formatNumber(d.prevQty)}</td>
                            </tr>
                            <tr className="text-muted">
                              <td className="py-1 pr-4">Units sold — current month</td>
                              <td className="py-1 font-mono text-white">{formatNumber(d.currQty)}</td>
                            </tr>
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

                      {(() => {
                        const familyEntries = Object.entries(report.areaFamilyChanges[area] ?? {}).sort(
                          (a, b) => b[1].absDrop - a[1].absDrop,
                        );
                        if (familyEntries.length === 0) return null;
                        return (
                        <div>
                          <div className="mb-2 text-xs font-semibold text-white">By product family</div>
                          <div className="space-y-1.5">
                            {familyEntries.map(([fam, fc]) => (
                              <div key={fam} className="flex items-center gap-2 text-xs">
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: colorForFamily(fam) }}
                                />
                                <span className="min-w-0 flex-1 truncate text-muted">{fam}</span>
                                <span className="shrink-0 font-mono text-muted">
                                  {formatNumber(fc.prevValue)} → {formatNumber(fc.currValue)}
                                </span>
                                <span
                                  className={`w-14 shrink-0 text-right font-mono ${
                                    fc.pctChange !== null && fc.pctChange < 0 ? "text-red" : "text-green"
                                  }`}
                                >
                                  {fc.pctChange !== null && fc.pctChange > 0 ? "+" : ""}
                                  {fc.pctChange ?? "—"}
                                  {fc.pctChange !== null ? "%" : ""}
                                </span>
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
  );
}
