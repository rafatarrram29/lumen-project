"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

/**
 * The one stat tile in the app.
 *
 * Sales and Market Insights each used to have their own — same shell, but
 * different label typography, a different value font, and an entrance
 * animation on one and not the other, so the two halves of the dashboard
 * visibly did not match. `subtitle` and `accent` are what the IMS version
 * needed on top; everything else is now shared, which is what makes the
 * two sections read as one product.
 */
export function StatTile({
  label,
  value,
  subtitle,
  tone = "default",
  accent,
  delayMs = 0,
}: {
  label: string;
  value: string;
  subtitle?: string;
  tone?: "default" | "red" | "amber" | "green";
  /** A CSS colour for the leading edge — used to key a tile to a series. */
  accent?: string;
  delayMs?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const toneClass = {
    default: "text-white",
    red: "text-red",
    amber: "text-amber",
    green: "text-green",
  }[tone];

  // The value is usually a short number, but a few tiles (like "Pattern")
  // show a word or two instead — those need a smaller size to fit the
  // tile at all; break-words is a last-resort safety net so nothing gets
  // silently cut off if a value is longer than any size class expects.
  const sizeClass = value.length > 10 ? "text-base" : value.length > 6 ? "text-lg" : "text-xl";

  return (
    <div
      className="rounded-xl border border-bdr bg-surf p-3.5 transition-all duration-500 ease-out"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(6px)",
        transitionDelay: `${delayMs}ms`,
        ...(accent ? { borderInlineStartWidth: 3, borderInlineStartColor: accent } : {}),
      }}
    >
      <div className="mb-1 text-xs text-muted">{label}</div>
      <div className={`break-words font-mono font-semibold leading-tight ${sizeClass} ${toneClass}`}>{value}</div>
      {subtitle && <div className="mt-0.5 break-words text-[11px] text-muted">{subtitle}</div>}
    </div>
  );
}

// pctChange is null for an entity with data in only ONE of the two
// compared months (a brand-new item's first month, or one that stopped
// selling entirely) — no percentage is mathematically defined starting or
// ending at zero, but the entity itself is still real and worth showing,
// tagged "New"/"Stopped" instead of a percentage. Used to be silently
// dropped from every comparison list before it ever reached this
// component, which is exactly why a dataset with several new/discontinued
// items could show far fewer rows than the number of real distinct
// entities in the file.
type BarRow = { key: string; label: string; pctChange: number | null; prevValue?: number; currValue?: number };

function DivergingBarChart({
  rows,
  maxRows,
  onRowClick,
}: {
  rows: BarRow[];
  maxRows: number;
  onRowClick?: (key: string) => void;
}) {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // A New/Stopped row (no percentage) has nothing to rank by size, so it's
  // treated as maximally noteworthy and sorted to the top rather than
  // dropped to the bottom by an implicit "smallest" comparison.
  const sorted = [...rows].sort(
    (a, b) => (b.pctChange === null ? Infinity : Math.abs(b.pctChange)) - (a.pctChange === null ? Infinity : Math.abs(a.pctChange)),
  );
  const [expanded, setExpanded] = useState(false);
  const plotted = expanded ? sorted : sorted.slice(0, maxRows);
  if (plotted.length === 0) return null;

  const numericAbs = plotted.map((r) => (r.pctChange !== null ? Math.abs(r.pctChange) : null)).filter((v): v is number => v !== null);
  const maxAbs = Math.max(...numericAbs, 1);
  const remaining = sorted.length - plotted.length;

  return (
    <>
      <div className="space-y-2.5">
        {plotted.map((row, i) => {
          // pctChange is null only when prevValue is 0 (a percentage
          // starting from zero is undefined) — an entity fully stopping
          // still produces a well-defined -100%, so null here always means
          // "just appeared", shown as growth-like (green) rather than a
          // percentage.
          const isDrop = row.pctChange !== null && row.pctChange < 0;
          const targetWidthPct = row.pctChange !== null ? (Math.abs(row.pctChange) / maxAbs) * 50 : 50;

          const Row = onRowClick ? "button" : "div";

          return (
            <Row
              key={row.key}
              type={onRowClick ? "button" : undefined}
              onClick={onRowClick ? () => onRowClick(row.key) : undefined}
              className={`flex w-full items-center gap-2 text-start text-xs ${
                onRowClick ? "cursor-pointer rounded-lg transition-colors hover:bg-surf2/60" : ""
              }`}
            >
              <div className="w-24 shrink-0 truncate text-muted sm:w-36" dir="auto" title={row.label}>
                {row.label}
              </div>
              <div className="relative h-2.5 min-w-0 flex-1 rounded-full bg-surf2">
                <div className="absolute inset-y-0 left-1/2 w-px bg-bdr" />
                <div
                  className="absolute inset-y-0 rounded-full transition-[width] ease-out"
                  style={{
                    ...(isDrop ? { right: "50%" } : { left: "50%" }),
                    width: mounted ? `${targetWidthPct}%` : "0%",
                    transitionDuration: "700ms",
                    transitionDelay: `${i * 40}ms`,
                    background: isDrop
                      ? "linear-gradient(90deg, var(--red), var(--red-2))"
                      : "linear-gradient(90deg, var(--green), var(--green-2))",
                  }}
                />
              </div>
              <div
                className={`w-16 shrink-0 text-end font-mono ${isDrop ? "text-red" : "text-green"}`}
                title={
                  row.prevValue !== undefined && row.currValue !== undefined
                    ? `${row.prevValue.toLocaleString("en-US")} → ${row.currValue.toLocaleString("en-US")}`
                    : undefined
                }
              >
                {row.pctChange !== null ? (
                  <>
                    {row.pctChange < 0 ? "" : "+"}
                    {row.pctChange}%
                  </>
                ) : (
                  <span className="text-[11px]">{t.dashboard.newEntry}</span>
                )}
              </div>
            </Row>
          );
        })}
      </div>

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 text-xs text-amber hover:underline"
        >
          {t.dashboard.showAll(sorted.length)}
        </button>
      )}
      {expanded && sorted.length > maxRows && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-3 text-xs text-muted hover:underline"
        >
          {t.dashboard.showLess}
        </button>
      )}
    </>
  );
}

export function AreaChangeBars({
  areas,
  onSelectArea,
}: {
  areas: [string, { pctChange: number | null; prevValue?: number; currValue?: number }][];
  onSelectArea?: (area: string) => void;
}) {
  const { t } = useLanguage();
  const rows: BarRow[] = areas.map(([area, d]) => ({
    key: area,
    label: area,
    pctChange: d.pctChange,
    prevValue: d.prevValue,
    currValue: d.currValue,
  }));

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-bdr bg-surf p-4 sm:p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">{t.dashboard.biggestMovers}</h2>
        <Legend />
      </div>
      <p className="mb-3 text-xs text-muted">{t.dashboard.tapArea}</p>
      <DivergingBarChart rows={rows} maxRows={12} onRowClick={onSelectArea} />
    </div>
  );
}

export function FamilyChangeBars({
  families,
  title,
}: {
  families: Record<string, { pctChange: number | null; prevValue?: number; currValue?: number }>;
  title?: string;
}) {
  const { t } = useLanguage();
  const rows: BarRow[] = Object.entries(families).map(([family, d]) => ({
    key: family,
    label: family,
    pctChange: d.pctChange,
    prevValue: d.prevValue,
    currValue: d.currValue,
  }));

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-bdr bg-surf p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">{title ?? t.dashboard.itemComparison}</h2>
        <Legend />
      </div>
      <DivergingBarChart rows={rows} maxRows={15} />
    </div>
  );
}

export function RepLeaderboard({
  repChanges,
  repTargets,
  hasTargets,
}: {
  repChanges: Record<string, { currValue: number }>;
  repTargets: Record<string, { pctOfTarget: number | null }>;
  hasTargets: boolean;
}) {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const rows = Object.entries(repChanges)
    .map(([rep, rc]) => {
      const pct = repTargets[rep]?.pctOfTarget ?? null;
      const usesPct = hasTargets && pct !== null;
      return { rep, metric: usesPct ? pct! : rc.currValue, usesPct, pct, currValue: rc.currValue };
    })
    .sort((a, b) => b.metric - a.metric)
    .slice(0, 10);

  if (rows.length === 0) return null;
  const maxMetric = Math.max(...rows.map((r) => r.metric), 1);

  return (
    <div className="rounded-2xl border border-bdr bg-surf p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-white">{t.dashboard.repLeaderboard}</h2>
      <div className="space-y-2.5">
        {rows.map((row, i) => (
          <div key={row.rep} className="flex items-center gap-2 text-xs">
            <span className="w-4 shrink-0 text-center font-mono text-muted">{i + 1}</span>
            <span className="w-20 shrink-0 truncate text-muted sm:w-32" dir="auto" title={row.rep}>
              {row.rep}
            </span>
            <div className="relative h-2.5 min-w-0 flex-1 rounded-full bg-surf2">
              <div
                className="absolute inset-y-0 start-0 rounded-full transition-[width] ease-out"
                style={{
                  width: mounted ? `${(row.metric / maxMetric) * 100}%` : "0%",
                  transitionDuration: "700ms",
                  transitionDelay: `${i * 40}ms`,
                  background: "linear-gradient(90deg, var(--amber), var(--amber-2))",
                }}
              />
            </div>
            <div className="w-16 shrink-0 text-end font-mono text-white">
              {row.usesPct ? `${row.pct}%` : row.currValue.toLocaleString("en-US")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-red" /> {t.dashboard.decline}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-green" /> {t.dashboard.growth}
      </span>
    </div>
  );
}
