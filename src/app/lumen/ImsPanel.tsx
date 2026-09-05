"use client";

import { useRef, useState } from "react";
import type { ImsAreaProduct, ImsFinding, ImsReport } from "@/lib/lumen/imsEngine";
import type { ImsColumnMapping } from "@/lib/lumen/imsMapping";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Translations } from "@/lib/i18n/translations";
import { ImsTrendChart } from "./ImsTrendChart";
import { StatTile } from "./charts";
import { EditableFieldValue } from "./EditableValue";

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

function formatSignedPct(n: number | null): string {
  if (n === null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

// The dimension a group is really "about" — product in the common case, or
// area for a file organized purely by geography with no product breakdown
// (isValidImsMapping guarantees at least one of the two is set).
function groupLabel(ap: ImsAreaProduct): string {
  return ap.product ?? ap.area ?? "—";
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

function RankingRow({
  ap,
  rank,
  active,
  onSelect,
  t,
}: {
  ap: ImsAreaProduct;
  rank: number;
  active: boolean;
  onSelect: () => void;
  t: Translations;
}) {
  const share = ap.latestShare ?? 0;
  const maxShare = 100;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start transition-colors ${
        active ? "bg-amber/10" : "hover:bg-surf2"
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${
          active ? "bg-amber text-on-accent" : "bg-surf2 text-muted"
        }`}
      >
        {rank}
      </span>
      <span className={`min-w-0 flex-1 truncate text-sm ${active ? "text-amber" : "text-white"}`} dir="auto" title={groupLabel(ap)}>
        {active ? "★ " : ""}
        {groupLabel(ap)}
      </span>
      <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-surf2">
        <span className="block h-full rounded-full bg-amber" style={{ width: `${Math.min(100, (share / maxShare) * 100)}%` }} />
      </span>
      <span className="w-16 shrink-0 text-end font-mono text-xs text-white">{formatShare(ap.latestShare)}</span>
      <span className="sr-only">{t.ims.latestShare}</span>
    </button>
  );
}

export function ImsPanel({
  report,
  files,
  loading,
  disabled,
  onAddFile,
  onDeleteFile,
  onRenameGroup,
  onRenameCompany,
}: {
  report: ImsReport | null;
  files: ImsFile[];
  loading: boolean;
  disabled: boolean;
  onAddFile: (file: File) => void;
  onDeleteFile: (file: ImsFile) => void;
  // A mis-extracted or mis-typed product/area/company name (e.g. a wrong
  // dosage strength pulled from a PDF) corrected here cascades across
  // every IMS file in the dataset — see /api/lumen/ims-files/rename.
  onRenameGroup: (ap: ImsAreaProduct, newLabel: string) => void;
  onRenameCompany: (oldName: string, newName: string) => void;
}) {
  const { t } = useLanguage();
  const addInputRef = useRef<HTMLInputElement>(null);

  const hasData = report !== null && report.areaProducts.length > 0;
  const groups = report && hasData ? [...report.areaProducts].sort((a, b) => (b.latestShare ?? -1) - (a.latestShare ?? -1)) : [];

  // Derived during render rather than synced via an effect: falls back to
  // the top-ranked group whenever the user's last explicit pick isn't (or
  // isn't yet) one of the current groups — a fresh report, a deleted file,
  // or simply no selection made yet — without a setState-in-effect render
  // cascade to get there.
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);
  const fallbackLabel = groups.length > 0 ? groupLabel(groups[0]) : null;
  const selectedLabel = pickedLabel && groups.some((ap) => groupLabel(ap) === pickedLabel) ? pickedLabel : fallbackLabel;

  const selected = groups.find((ap) => groupLabel(ap) === selectedLabel) ?? null;
  const selectedFinding =
    selected && report
      ? report.findings.find(
          (f): f is Extract<ImsFinding, { type: "share_move" }> =>
            f.type === "share_move" && f.product === selected.product && f.area === selected.area,
        )
      : undefined;

  return (
    <div>
      <input
        ref={addInputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt,.ods,.pdf"
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

      {!loading && hasData && report && selected && (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {groups.map((ap) => {
              const label = groupLabel(ap);
              const active = label === selectedLabel;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setPickedLabel(label)}
                  dir="auto"
                  className={`max-w-[10rem] truncate rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-amber bg-amber/15 text-amber"
                      : "border-bdr text-muted hover:border-amber/50 hover:text-white"
                  }`}
                  title={label}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <StatTile
              label={t.ims.ytdMarketShare}
              value={formatShare(selected.latestShare)}
              subtitle={selected.rank !== null ? t.ims.rankInCategory(selected.rank, selected.totalInGroup) : t.ims.notAvailable}
              accent="var(--red)"
              delayMs={0}
            />
            <StatTile
              label={t.ims.ourGrowth}
              value={formatSignedPct(selected.ourGrowthRate)}
              subtitle={t.ims.ourGrowthSubtitle}
              accent="var(--amber)"
              delayMs={60}
            />
            <StatTile
              label={t.ims.marketGrowthLabel}
              value={formatSignedPct(selected.marketGrowthRate)}
              subtitle={t.ims.marketGrowthSubtitle}
              accent="var(--cyan)"
              delayMs={120}
            />
            <StatTile
              label={t.ims.shareGainLossLabel}
              value={formatPoints(selected.pctPointChange)}
              subtitle={t.ims.shareGainLossSubtitle}
              accent="var(--red)"
              delayMs={180}
            />
          </div>

          <div className="mb-5 rounded-2xl border border-bdr bg-surf p-4">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white">
              <span>{t.ims.analysisTitleLabel}</span>
              <span aria-hidden>—</span>
              <EditableFieldValue
                value={groupLabel(selected)}
                title={t.inlineEdit.renameHint}
                onSave={async (v) => onRenameGroup(selected, v.trim())}
              />
            </div>
            <p className="mb-2 break-words text-sm text-muted" dir="auto">
              {t.ims.positionShareLine(
                formatShare(selected.latestShare),
                selected.rank !== null ? t.ims.rankInCategory(selected.rank, selected.totalInGroup) : t.ims.notAvailable,
              )}
            </p>
            {(selected.ourGrowthRate !== null || selected.marketGrowthRate !== null) && (
              <p className="mb-2 break-words text-sm text-muted" dir="auto">
                {t.ims.positionGrowthLine(formatSignedPct(selected.ourGrowthRate), formatSignedPct(selected.marketGrowthRate))}
              </p>
            )}
            {selectedFinding && <FindingCard finding={selectedFinding} t={t} />}
          </div>

          {selected.series.length > 0 && selected.series[selected.series.length - 1].competitorShares.length > 0 && (
            <div className="mb-5">
              <div className="mb-2 text-sm font-semibold text-white">{t.ims.monthlyTrendTitle}</div>
              <ImsTrendChart series={selected.series} ownLabel={groupLabel(selected)} />
            </div>
          )}

          {selected.series.length > 0 && selected.series[selected.series.length - 1].competitorShares.length > 0 && (
            <div className="mb-5">
              <div className="mb-2 text-sm font-semibold text-white">{t.ims.competitorsTitle}</div>
              <div className="overflow-hidden rounded-2xl border border-bdr">
                {[...selected.series[selected.series.length - 1].competitorShares]
                  .sort((a, b) => b.share - a.share)
                  .map((c, i) => (
                    <div
                      key={c.company}
                      className={`flex items-center justify-between px-3 py-2 text-sm ${i > 0 ? "border-t border-bdr/60" : ""}`}
                    >
                      <EditableFieldValue
                        value={c.company}
                        className="min-w-0 truncate text-white"
                        title={t.inlineEdit.renameHint}
                        onSave={async (v) => onRenameCompany(c.company, v.trim())}
                      />
                      <span className="ms-3 shrink-0 font-mono text-xs text-muted">{formatShare(c.share)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 text-sm font-semibold text-white">{t.ims.marketRankingTitle}</div>
            <div className="rounded-2xl border border-bdr p-1.5">
              {groups.map((ap, i) => (
                <RankingRow
                  key={groupLabel(ap)}
                  ap={ap}
                  rank={i + 1}
                  active={groupLabel(ap) === selectedLabel}
                  onSelect={() => setPickedLabel(groupLabel(ap))}
                  t={t}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
