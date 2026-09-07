"use client";

// Target vs Achievement for whatever card it sits in — one area, one rep,
// or a manager's whole team.
//
// The same panel in all three places on purpose. A district manager
// reading their team's number and a rep reading their own should be
// reading the same thing computed the same way, or the review meeting
// starts with an argument about whose figure is right.

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Progress, TeamProgress } from "@/lib/lumen/targetProgress";
import { EditableValue } from "./EditableValue";
import { TargetComparisonChart } from "./TargetComparisonChart";
import { formatNumber, LoadingBlock } from "./dashboardBits";

/** Which month a hand-typed target applies to. */
export type TargetEdit = { item: string; month: number; newValue: number };

function AchBadge({ pct, threshold, testId }: { pct: number | null; threshold: number; testId?: string }) {
  const { t } = useLanguage();
  if (pct === null) {
    return <span data-testid={testId} className="rounded-full border border-bdr px-2 py-0.5 font-mono text-[11px] text-muted">—</span>;
  }
  const under = pct < threshold;
  return (
    <span
      data-testid={testId}
      className={`rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold ${
        under ? "border-red/40 bg-red/20 text-red" : "border-green/40 bg-green/20 text-green"
      }`}
      title={under ? t.targets.underTarget : undefined}
    >
      {pct}%
    </span>
  );
}

function Tile({ label, value, tone, testId }: { label: string; value: string; tone?: "amber" | "cyan"; testId?: string }) {
  return (
    <div className="rounded-xl border border-bdr bg-surf2/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div data-testid={testId} className={`font-mono text-sm font-semibold ${tone === "cyan" ? "text-cyan" : "text-amber"}`}>{value}</div>
    </div>
  );
}

export function TargetProgressPanel({
  progress,
  threshold,
  /** The month a hand-typed target is filed under — the report's latest. */
  editMonth,
  onAddTarget,
  onEditTarget,
  loading,
  compact,
}: {
  progress: Progress | TeamProgress | null;
  threshold: number;
  editMonth: number;
  /** Absent on the manager panel: a team's plan is uploaded per rep. */
  onAddTarget?: () => void;
  /** Absent where the figures are a roll-up and there is no single row to edit. */
  onEditTarget?: (edit: TargetEdit) => Promise<void>;
  loading?: boolean;
  /** Fewer items listed, for a panel sitting inside another card. */
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const [showAllItems, setShowAllItems] = useState(false);

  if (loading) {
    return <LoadingBlock height="h-40" label={t.common.loading} />;
  }

  const team = progress && "members" in progress ? (progress as TeamProgress) : null;
  const hasTarget = Boolean(progress && progress.totalTarget > 0);

  return (
    <div data-testid={team ? "team-target-panel" : "target-panel"} className="rounded-xl border border-bdr bg-surf2/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white">
            {team ? t.targets.teamTargetTitle : t.targets.progressTitle}
          </div>
          <div className="text-[11px] text-muted">
            {progress?.focusMonth ? t.targets.progressSubtitleMonth(progress.focusMonth) : t.targets.progressSubtitle}
          </div>
        </div>
        {onAddTarget && (
          <button
            type="button"
            onClick={onAddTarget}
            className="shrink-0 rounded-lg border border-dashed border-bdr px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-amber hover:text-white"
          >
            {t.targets.addTargetButton}
          </button>
        )}
      </div>

      {!hasTarget ? (
        <p className="rounded-lg border border-bdr px-3 py-2 text-[11px] text-muted">{t.targets.noTargetYet}</p>
      ) : (
        <>
          <div data-testid="target-tiles" className="mb-3 grid grid-cols-3 gap-2">
            <Tile testId="target-sales" label={t.targets.salesLabel} value={formatNumber(progress!.totalSales)} />
            <Tile testId="target-total" label={t.targets.targetLabel} value={formatNumber(progress!.totalTarget)} tone="cyan" />
            <div className="flex items-center justify-between rounded-xl border border-bdr bg-surf2/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted">{t.targets.achLabel}</div>
              <AchBadge pct={progress!.achPct} threshold={threshold} testId="target-ach" />
            </div>
          </div>

          {/* A manager's card says how many of the team are behind before
              anyone opens a single rep. */}
          {team && team.measuredCount > 0 && (
            <p
              className={`mb-3 rounded-lg px-3 py-2 text-[11px] font-semibold ${
                team.belowTarget.length > 0 ? "bg-red/10 text-red" : "bg-green/10 text-green"
              }`}
            >
              {team.belowTarget.length > 0
                ? `${t.targets.repsBelowTarget(team.belowTarget.length, team.measuredCount)} — ${team.belowTarget.join(", ")}`
                : t.targets.allRepsOnTarget}
            </p>
          )}

          {/* Reps with no plan are named rather than quietly folded into
              the team's percentage — see rollUpTeam. */}
          {team && team.unmeasured.length > 0 && (
            <p className="mb-3 rounded-lg bg-amber/10 px-3 py-2 text-[11px] text-amber" dir="auto">
              {t.targets.repsWithoutTarget(team.unmeasured.join(", "))}
            </p>
          )}

          {progress!.achPct !== null && progress!.achPct < threshold && (
            <p className="mb-3 rounded-lg bg-red/10 px-3 py-2 text-[11px] font-semibold text-red">
              {t.targets.underTargetBy(Math.round((100 - progress!.achPct) * 10) / 10)}
            </p>
          )}

          <TargetComparisonChart months={progress!.months} threshold={threshold} t={t} height={compact ? "h-44" : "h-52"} />

          {/* Where the plan file's own Ach% and ours disagree. Reported,
              not resolved — which is right is a question about the file. */}
          {progress!.mismatches.length > 0 && (
            <div className="mt-3 space-y-1">
              {progress!.mismatches.slice(0, 4).map((m) => (
                <p key={m.label} className="rounded-lg bg-amber/10 px-3 py-1.5 text-[11px] text-amber" dir="auto">
                  {t.targets.achMismatch(m.label, m.fileAchPct, m.computedAchPct)}
                </p>
              ))}
            </div>
          )}

          {progress!.items.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-white">{t.dashboard.byItem}</span>
                {onEditTarget && <span className="text-muted">{t.targets.editTargetHint}</span>}
              </div>
              <div className="space-y-1">
                {(showAllItems || !compact ? progress!.items : progress!.items.slice(0, 5)).map((i) => (
                  <div key={i.item} data-testid="target-item-row" className="flex items-center gap-2 text-[11px]">
                    <span className="min-w-0 flex-1 truncate text-muted" dir="auto">
                      {i.item}
                      {i.isManual && (
                        <span className="ms-1.5 text-[9px] text-amber" title={t.targets.manualTargetHint}>
                          ✎
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-white">{formatNumber(i.sales)}</span>
                    <span className="shrink-0 text-muted">/</span>
                    <span data-testid="target-item-value" className="shrink-0 font-mono text-cyan">
                      {onEditTarget ? (
                        <EditableValue
                          value={i.target}
                          formatted={formatNumber(i.target)}
                          onSave={(newValue) => onEditTarget({ item: i.item, month: editMonth, newValue })}
                        />
                      ) : (
                        formatNumber(i.target)
                      )}
                    </span>
                    <AchBadge pct={i.achPct} threshold={threshold} />
                  </div>
                ))}
              </div>
              {compact && progress!.items.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllItems((v) => !v)}
                  className="mt-1 text-[11px] text-amber hover:underline"
                >
                  {showAllItems ? t.dashboard.showLess : t.dashboard.showAll(progress!.items.length)}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
