"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function StatTile({
  label,
  value,
  tone = "default",
  delayMs = 0,
}: {
  label: string;
  value: string;
  tone?: "default" | "red" | "amber" | "green";
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
      }}
    >
      <div className="mb-1 text-xs text-muted">{label}</div>
      <div className={`break-words font-mono font-semibold leading-tight ${sizeClass} ${toneClass}`}>{value}</div>
    </div>
  );
}

type BarRow = { key: string; label: string; pctChange: number };

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

  const plotted = rows.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange)).slice(0, maxRows);
  if (plotted.length === 0) return null;

  const maxAbs = Math.max(...plotted.map((r) => Math.abs(r.pctChange)), 1);
  const remaining = rows.length - plotted.length;

  return (
    <>
      <div className="space-y-2.5">
        {plotted.map((row, i) => {
          const isDrop = row.pctChange < 0;
          const targetWidthPct = (Math.abs(row.pctChange) / maxAbs) * 50;

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
                      ? "linear-gradient(90deg, #fb7185, #f43f5e)"
                      : "linear-gradient(90deg, #4ade80, #22c55e)",
                  }}
                />
              </div>
              <div className={`w-16 shrink-0 text-end font-mono ${isDrop ? "text-red" : "text-green"}`}>
                {isDrop ? "" : "+"}
                {row.pctChange}%
              </div>
            </Row>
          );
        })}
      </div>

      {remaining > 0 && (
        <p className="mt-3 text-xs text-muted">{t.dashboard.moreInList(remaining)}</p>
      )}
    </>
  );
}

export function AreaChangeBars({
  areas,
  onSelectArea,
}: {
  areas: [string, { pctChange: number | null }][];
  onSelectArea?: (area: string) => void;
}) {
  const { t } = useLanguage();
  const rows: BarRow[] = areas
    .filter(([, d]) => d.pctChange !== null)
    .map(([area, d]) => ({ key: area, label: area, pctChange: d.pctChange! }));

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
  families: Record<string, { pctChange: number | null }>;
  title?: string;
}) {
  const { t } = useLanguage();
  const rows: BarRow[] = Object.entries(families)
    .filter(([, d]) => d.pctChange !== null)
    .map(([family, d]) => ({ key: family, label: family, pctChange: d.pctChange! }));

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-bdr bg-surf p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">{title ?? t.dashboard.itemComparison}</h2>
        <Legend />
      </div>
      <DivergingBarChart rows={rows} maxRows={10} />
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
