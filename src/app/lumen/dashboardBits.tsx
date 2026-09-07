"use client";

// Small pieces the dashboard shares.
//
// These lived inside LumenClient, which was fine while only LumenClient
// drew an area. AreaDetail now draws the same area under a district
// manager's card, so anything both need has to sit somewhere they can both
// reach — otherwise the manager view slowly grows its own slightly
// different badge, its own slightly different number formatting, and stops
// looking like the same product.

import type { ReactNode } from "react";
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

/**
 * A small spinning ring, for any control or panel that has been waiting on
 * a network response long enough to say so — a bare `animate-pulse`
 * skeleton reads as "empty" at a glance; this one only ever reads as
 * "working".
 */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`${className} animate-spin text-current`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/**
 * The placeholder for a card region that is still fetching its own slice
 * of data (a manager's item charts, a rep's area detail, a target panel).
 * Same pulsing block as before so the layout doesn't jump, plus a spinner
 * and label so waiting on it never looks the same as there being nothing
 * to show.
 */
export function LoadingBlock({ height = "h-24", label }: { height?: string; label: string }) {
  return (
    <div className={`flex ${height} animate-pulse items-center justify-center gap-2 rounded-lg bg-surf2 text-xs text-muted`}>
      <Spinner className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
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

/**
 * A percentage change, in the dashboard's one house style: signed, red
 * below zero, green at or above it, and an em dash where the previous
 * month had nothing to compare against (a new area or item is not "0%").
 */
export function PctDelta({ pctChange }: { pctChange: number | null }) {
  return (
    <span className={`shrink-0 font-mono ${pctChange !== null && pctChange < 0 ? "text-red" : "text-green"}`}>
      {pctChange !== null && pctChange > 0 ? "+" : ""}
      {pctChange ?? "—"}
      {pctChange !== null ? "%" : ""}
    </span>
  );
}

/**
 * One line of a breakdown list — the items list, the reps list — as a
 * clickable header plus the month-over-month figures under it.
 *
 * The three lists that use this were written separately and had drifted:
 * same row, three copies of the percentage formatting, three slightly
 * different ways of laying out the prev-to-curr line. What actually
 * differs between them is what sits either side of the number, so that is
 * what the slots are for; the detail each one opens is its own and stays
 * its own, passed as children.
 */
export function BreakdownRow({
  id,
  name,
  pctChange,
  prevValue,
  currValue,
  comparedToMonth,
  latestMonth,
  isOpen,
  onToggle,
  t,
  leading,
  trailing,
  children,
}: {
  id: string;
  name: string;
  pctChange: number | null;
  prevValue: number;
  currValue: number;
  comparedToMonth: number;
  latestMonth: number;
  isOpen: boolean;
  onToggle: () => void;
  t: Translations;
  /** Before the name — the item's colour dot, for instance. */
  leading?: ReactNode;
  /** After the number — a target chip, for instance. */
  trailing?: ReactNode;
  /** The drill-down this row opens. */
  children?: ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-4 text-xs">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-lg text-start transition-colors hover:bg-surf2/60"
      >
        {leading}
        <span className="min-w-0 flex-1 truncate text-muted" dir="auto">
          {name}
        </span>
        <PctDelta pctChange={pctChange} />
        {trailing}
        <span className="shrink-0 text-[10px] text-muted">{isOpen ? t.common.hide : t.common.details}</span>
      </button>
      <div className="ps-4 font-mono text-[11px] break-words text-muted">
        {t.common.month(comparedToMonth)}: {formatNumber(prevValue)} → {t.common.month(latestMonth)}:{" "}
        {formatNumber(currValue)}
      </div>
      {isOpen && children}
    </div>
  );
}
