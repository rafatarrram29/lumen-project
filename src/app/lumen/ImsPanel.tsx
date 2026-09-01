"use client";

import { useRef } from "react";
import type { ImsAreaProduct, ImsFinding, ImsReport } from "@/lib/lumen/imsEngine";
import type { ImsColumnMapping } from "@/lib/lumen/imsMapping";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Translations } from "@/lib/i18n/translations";

export type ImsFile = {
  id: string;
  displayName: string;
  columnMapping: ImsColumnMapping;
  ownCompany: string | null;
  createdAt: string;
};

function formatShare(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}%`;
}

function formatPoints(n: number | null): string {
  if (n === null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}`;
}

function FindingCard({ finding, t }: { finding: ImsFinding; t: Translations }) {
  if (finding.type === "share_move") {
    const isDrop = finding.direction === "drop";
    let text = isDrop
      ? t.ims.shareDropSummary(finding.product, finding.area, finding.pctPointChange, finding.monthsSpan)
      : t.ims.shareGainSummary(finding.product, finding.area, finding.pctPointChange, finding.monthsSpan);
    if (finding.competitorMove) {
      text += t.ims.competitorMoveNote(finding.competitorMove.company, finding.competitorMove.pctPointChange);
    }
    return (
      <div className={`mb-3 rounded-2xl border p-4 text-sm ${isDrop ? "border-red/40 bg-red/10" : "border-green/40 bg-green/10"}`}>
        <p className="break-words" dir="auto">
          {text}
        </p>
      </div>
    );
  }

  const isMarketOutpacing = finding.direction === "market_outpacing_us";
  const text = isMarketOutpacing
    ? t.ims.marketOutpacingUs(finding.area, finding.salesPctChange, finding.sharePctPointChange)
    : t.ims.weOutpacingMarket(finding.area, finding.salesPctChange, finding.sharePctPointChange);
  return (
    <div className={`mb-3 rounded-2xl border p-4 text-sm ${isMarketOutpacing ? "border-amber/40 bg-amber/10" : "border-green/40 bg-green/10"}`}>
      <p className="break-words" dir="auto">
        {text}
      </p>
    </div>
  );
}

function AreaProductRow({ row, t }: { row: ImsAreaProduct; t: Translations }) {
  const changePositive = row.pctPointChange !== null && row.pctPointChange > 0;
  const changeNegative = row.pctPointChange !== null && row.pctPointChange < 0;
  return (
    <tr className="border-b border-bdr/60 last:border-0">
      <td className="max-w-[10rem] truncate px-3 py-2 text-white" dir="auto" title={row.area}>
        {row.area}
      </td>
      <td className="max-w-[10rem] truncate px-3 py-2 text-white" dir="auto" title={row.product}>
        {row.product}
      </td>
      <td className="px-3 py-2 font-mono text-white">{formatShare(row.latestShare)}</td>
      <td className={`px-3 py-2 font-mono ${changePositive ? "text-green" : changeNegative ? "text-red" : "text-muted"}`}>
        {formatPoints(row.pctPointChange)}
      </td>
      <td className="px-3 py-2 text-muted">
        {row.topCompetitor ? (
          <span dir="auto">
            {row.topCompetitor.company} ({formatShare(row.topCompetitor.share)}
            {row.topCompetitor.pctPointChange !== null ? `, ${formatPoints(row.topCompetitor.pctPointChange)}` : ""})
          </span>
        ) : (
          t.ims.noCompetitorData
        )}
      </td>
    </tr>
  );
}

export function ImsPanel({
  report,
  files,
  loading,
  disabled,
  onAddFile,
  onDeleteFile,
}: {
  report: ImsReport | null;
  files: ImsFile[];
  loading: boolean;
  disabled: boolean;
  onAddFile: (file: File) => void;
  onDeleteFile: (file: ImsFile) => void;
}) {
  const { t } = useLanguage();
  const addInputRef = useRef<HTMLInputElement>(null);

  const hasData = report !== null && report.areaProducts.length > 0;
  const vsMonths = report && report.latestMonth !== null && report.prevMonth !== null ? report.latestMonth - report.prevMonth : null;

  return (
    <div>
      <input
        ref={addInputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt,.ods"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAddFile(file);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold text-muted">{t.ims.filesTitle}</div>
          <div className="flex flex-col gap-1.5">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-1.5 rounded-lg border border-bdr px-2.5 py-1.5 text-xs">
                <span className="min-w-0 flex-1 truncate text-white" dir="auto" title={f.displayName}>
                  {f.displayName}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onDeleteFile(f)}
                  title={t.ims.deleteButton}
                  aria-label={t.ims.deleteButton}
                  className="shrink-0 text-muted hover:text-red disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => addInputRef.current?.click()}
        disabled={disabled}
        className="mb-5 w-full rounded-lg border border-dashed border-bdr px-3 py-2 text-xs text-muted transition-colors hover:border-amber hover:text-white disabled:opacity-60"
      >
        {t.ims.uploadButton}
      </button>

      {loading && <p className="text-sm text-muted">{t.sidebar.loading}</p>}

      {!loading && !hasData && (
        <div className="rounded-2xl border border-bdr bg-surf p-6 text-center">
          <p className="mb-1 text-sm font-semibold text-white">{t.ims.emptyTitle}</p>
          <p className="mx-auto max-w-md text-xs text-muted">{t.ims.emptyBody}</p>
        </div>
      )}

      {!loading && hasData && report && (
        <>
          <div className="mb-5">
            <div className="mb-2 text-sm font-semibold text-white">{t.ims.findingsTitle}</div>
            {report.findings.length === 0 ? (
              <p className="text-sm text-muted">{t.ims.noFindings}</p>
            ) : (
              report.findings.map((f, i) => <FindingCard key={i} finding={f} t={t} />)
            )}
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-white">{t.ims.byAreaProduct}</div>
            <div className="overflow-x-auto rounded-2xl border border-bdr">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-bdr text-muted">
                    <th className="px-3 py-2 font-normal">{t.ims.fieldArea}</th>
                    <th className="px-3 py-2 font-normal">{t.ims.fieldProduct}</th>
                    <th className="px-3 py-2 font-normal">{t.ims.latestShare}</th>
                    <th className="px-3 py-2 font-normal">
                      {t.ims.change} {vsMonths !== null ? t.ims.vsMonthsAgo(vsMonths) : ""}
                    </th>
                    <th className="px-3 py-2 font-normal">{t.ims.topCompetitor}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.areaProducts.map((row, i) => (
                    <AreaProductRow key={i} row={row} t={t} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
