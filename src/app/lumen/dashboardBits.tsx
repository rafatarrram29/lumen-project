"use client";

// Small pieces the dashboard shares.
//
// These lived inside LumenClient, which was fine while only LumenClient
// drew an area. AreaDetail now draws the same area under a district
// manager's card, so anything both need has to sit somewhere they can both
// reach — otherwise the manager view slowly grows its own slightly
// different badge, its own slightly different number formatting, and stops
// looking like the same product.

import type { Translations } from "@/lib/i18n/translations";

export function areaCardId(area: string): string {
  return `area-card-${encodeURIComponent(area)}`;
}

export function itemCardId(item: string): string {
  return `item-card-${encodeURIComponent(item)}`;
}

export function repCardId(rep: string): string {
  return `rep-card-${encodeURIComponent(rep)}`;
}



export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function Badge({ pctChange }: { pctChange: number | null }) {
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

export function TargetChip({
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
