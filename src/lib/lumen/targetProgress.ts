// Target vs Achievement, for one slice of the org chart.
//
// The dashboard has compared a target to an actual since targets existed,
// but only for the latest month and only as a single percentage. A rep
// being asked "how are you tracking?" needs the months side by side, the
// items that make up the gap, and — for their manager — the same figures
// summed across a team.
//
// This file is the arithmetic, and nothing else: no fetching, no React.
// That matters because every number here ends up in a performance
// conversation, so each rule is stated once and tested rather than
// re-derived in a component.

/** A target row as stored — see supabase/lumen_target_progress_migration.sql. */
export type TargetRow = {
  area: string | null;
  rep: string | null;
  item: string | null;
  month: number;
  targetValue: number;
  /** The achievement % the uploaded file carried, if it carried one. */
  achPct: number | null;
  /** Typed in from a card rather than read from a file. */
  isManual: boolean;
  /**
   * This row's own actual-sales figure, when the file it came from carried
   * one (a combined Sales-vs-Target export) — see
   * supabase/lumen_targets_own_sales_migration.sql. Null for a plain
   * targets file, in which case buildProgress falls back to matching this
   * row's scope against the separately-uploaded ActualRow[] instead.
   */
  salesValue: number | null;
};

/** The sales side, at the grain the comparison needs. */
export type ActualRow = {
  area: string;
  item: string;
  rep: string | null;
  month: number;
  value: number;
};

export type MonthProgress = {
  month: number;
  sales: number;
  target: number;
  /** Null when there is no target to measure against — not zero. */
  achPct: number | null;
};

export type ItemProgress = {
  item: string;
  sales: number;
  target: number;
  achPct: number | null;
  /** The file's own figure, when it had one and they disagree. */
  fileAchPct: number | null;
  isManual: boolean;
};

export type Progress = {
  /** Every month in scope — what the comparison chart draws. */
  months: MonthProgress[];
  /** The focus month's items, worst-achieving first. */
  items: ItemProgress[];
  /** The month the tiles and the item list describe. */
  focusMonth: number | null;
  totalSales: number;
  totalTarget: number;
  achPct: number | null;
  /**
   * Rows whose uploaded Ach% does not match sales / target. Reported
   * rather than resolved: which one is right is a question about the plan
   * file, not something this code can decide.
   */
  mismatches: { label: string; fileAchPct: number; computedAchPct: number }[];
};

/** Which part of the org chart a comparison covers. */
export type ProgressScope = {
  /** Areas in scope. Empty means "not scoped by area". */
  areas?: string[];
  /** The rep in scope, if any. */
  rep?: string | null;
};

/**
 * How far apart the file's Ach% and ours have to be before it is worth
 * saying so. Plan files round; two points of rounding is not a discrepancy
 * worth interrupting anyone about.
 */
export const ACH_MISMATCH_TOLERANCE = 2;

/** Sales over target as a percentage, or null when there is no target. */
export function achievement(sales: number, target: number): number | null {
  if (!Number.isFinite(target) || target <= 0) return null;
  return Math.round((sales / target) * 1000) / 10;
}

export type ScopeReadFilters = {
  /** Every area named by any of the request's scopes, deduplicated. */
  areas: string[];
  /** Every rep named by any of the request's scopes, deduplicated. */
  reps: string[];
};

/**
 * The narrowest set of rows a caller's own database read can be limited to
 * while still being guaranteed to include everything inScope() could keep
 * for ANY of these scopes — so the read can be scoped down from "the whole
 * dataset" to "what this request could possibly need" without silently
 * dropping a row a wider, unscoped read would have kept.
 *
 * This is the read-side mirror of inScope() itself: change one, check
 * whether the other still holds. A row inScope() can ever keep for one of
 * these scopes always names either its own area (in scope.areas) or its
 * own rep (as scope.rep) — see inScope's own reasoning — so "area IN
 * these areas OR rep IN these reps" alone is a safe superset; no scope
 * needs its own bare "and every unattributed row too" carve-out.
 */
export function scopeReadFilters(scopes: ProgressScope[]): ScopeReadFilters {
  const areas = [...new Set(scopes.flatMap((s) => s.areas ?? []))];
  const reps = [...new Set(scopes.map((s) => s.rep).filter((r): r is string => Boolean(r)))];
  return { areas, reps };
}

/**
 * Whether a row belongs to a scope.
 *
 * A sales row always names a real area — "which rep sold it" is an extra
 * dimension on top, never a substitute for it, so an area-only query
 * correctly wants every sale in that area regardless of which rep made it.
 *
 * A TARGET row is different: one uploaded from inside a rep's card carries
 * no Area column at all (the card supplied the rep instead), so its area
 * is null — and null there is not "unknown, could be anywhere," it is "this
 * row's only identity is the rep who own it." Treating that null the same
 * as a sales row's (impossible) blank area is exactly the bug this fixes:
 * a bare area query with no rep of its own used to treat "row names no
 * area" as "let it through," which meant one rep's entire card-scoped plan
 * showed up under every unrelated area's own card, sharing nothing with
 * that rep beyond a coincidentally blank area column.
 *
 * So a row with no area of its own is matched by rep alone, never by area
 * (it has none to match); a row that does name an area is matched exactly
 * as before — by area, and by rep too when the row names one and the scope
 * asks for a specific one.
 */
function inScope(row: { area: string | null; rep: string | null }, scope: ProgressScope): boolean {
  const areas = scope.areas ?? [];

  if (row.area == null) {
    if (row.rep) return row.rep === scope.rep;
    // Neither dimension at all: belongs only to a fully unscoped read.
    return !scope.rep && areas.length === 0;
  }

  if (scope.rep && row.rep && row.rep !== scope.rep) return false;
  if (areas.length > 0 && !areas.includes(row.area)) return false;
  return true;
}

/** Actual sales rows belonging to a scope. */
export function actualsInScope(rows: ActualRow[], scope: ProgressScope): ActualRow[] {
  return rows.filter((r) => inScope({ area: r.area, rep: r.rep }, scope));
}

/** Target rows belonging to a scope. */
export function targetsInScope(rows: TargetRow[], scope: ProgressScope): TargetRow[] {
  return rows.filter((r) => inScope(r, scope));
}

/**
 * The full comparison for one scope.
 *
 * The chart covers every month in scope. Everything else — the headline
 * tiles and the item list — describes ONE month, `focusMonth`, defaulting
 * to the latest month either side has data for.
 *
 * That is not a detail. The item list is editable, and an edit writes one
 * month; a list showing a six-month total next to an input that replaces
 * one month's figure is a trap, and it was one until a browser test typed
 * 435,929 into a cell reading 335,929 and moved the total by 379,242. It
 * also matches the rest of the dashboard, where "under target" has always
 * meant the latest month.
 */
export function buildProgress(
  actuals: ActualRow[],
  targets: TargetRow[],
  scope: ProgressScope,
  focus?: number,
): Progress {
  const tgts = targetsInScope(targets, scope);

  // A combined Sales-vs-Target export carries its own actual-sales figure
  // on the same row as its plan (see columnMapping.ts's salesValue
  // mapping). When any row in scope has one, that becomes the ONLY source
  // of "sales" for this scope: matching it up against the separately
  // uploaded Sales dataset on top would double-count, and the whole point
  // of mapping that column is to trust the numbers the file itself named.
  const hasOwnSales = tgts.some((t) => t.salesValue !== null);
  const acts = hasOwnSales ? [] : actualsInScope(actuals, scope);

  const byMonth = new Map<number, { sales: number; target: number }>();
  const bump = (m: number, key: "sales" | "target", v: number) => {
    const cur = byMonth.get(m) ?? { sales: 0, target: 0 };
    cur[key] += v;
    byMonth.set(m, cur);
  };
  for (const a of acts) bump(a.month, "sales", a.value);
  for (const t of tgts) {
    bump(t.month, "target", t.targetValue);
    if (t.salesValue !== null) bump(t.month, "sales", t.salesValue);
  }

  const months: MonthProgress[] = [...byMonth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([month, v]) => ({
      month,
      sales: Math.round(v.sales),
      target: Math.round(v.target),
      achPct: achievement(v.sales, v.target),
    }));

  const focusMonth =
    focus ?? (months.length > 0 ? months[months.length - 1].month : null);
  const focusActs = acts.filter((a) => a.month === focusMonth);
  const focusTgts = tgts.filter((t) => t.month === focusMonth);

  const byItem = new Map<string, { sales: number; target: number; fileAch: number[]; manual: boolean }>();
  const itemEntry = (item: string) => {
    const cur = byItem.get(item) ?? { sales: 0, target: 0, fileAch: [], manual: false };
    byItem.set(item, cur);
    return cur;
  };
  for (const a of focusActs) itemEntry(a.item).sales += a.value;
  for (const t of focusTgts) {
    // A target row with no item is the scope's overall plan, not any one
    // item's, so it counts toward the totals but not the item breakdown.
    if (!t.item) continue;
    const e = itemEntry(t.item);
    e.target += t.targetValue;
    if (t.salesValue !== null) e.sales += t.salesValue;
    if (t.achPct !== null) e.fileAch.push(t.achPct);
    if (t.isManual) e.manual = true;
  }

  // The file's Ach% is checked ROW BY ROW — one item in one month —
  // against that month's own sales and target. Checking an item's average
  // across the period instead let a single wrong month hide: five months
  // at 92% and one claiming 99.4% average to 93.2%, inside any sensible
  // tolerance, and the one bad figure went unreported.
  const mismatches: Progress["mismatches"] = [];
  const cellSales = new Map<string, number>();
  const cellTarget = new Map<string, number>();
  const cellFileAch = new Map<string, number[]>();
  const cellKey = (item: string, month: number) => `${month}\u0000${item}`;
  for (const a of acts) cellSales.set(cellKey(a.item, a.month), (cellSales.get(cellKey(a.item, a.month)) ?? 0) + a.value);
  for (const t of tgts) {
    if (!t.item) continue;
    const k = cellKey(t.item, t.month);
    cellTarget.set(k, (cellTarget.get(k) ?? 0) + t.targetValue);
    if (t.salesValue !== null) cellSales.set(k, (cellSales.get(k) ?? 0) + t.salesValue);
    if (t.achPct !== null) cellFileAch.set(k, [...(cellFileAch.get(k) ?? []), t.achPct]);
  }
  for (const [k, fileAchList] of cellFileAch) {
    const [monthStr, item] = k.split("\u0000");
    const computed = achievement(cellSales.get(k) ?? 0, cellTarget.get(k) ?? 0);
    if (computed === null) continue;
    // One item in one month can still be split across areas; those rows
    // describe the same cell, so they are averaged before comparing.
    const fileAchPct = Math.round((fileAchList.reduce((s, n) => s + n, 0) / fileAchList.length) * 10) / 10;
    if (Math.abs(fileAchPct - computed) > ACH_MISMATCH_TOLERANCE) {
      mismatches.push({ label: `${item} · M${monthStr}`, fileAchPct, computedAchPct: computed });
    }
  }

  const items: ItemProgress[] = [...byItem.entries()]
    .map(([item, v]) => {
      const computed = achievement(v.sales, v.target);
      const fileAchPct =
        v.fileAch.length > 0
          ? Math.round((v.fileAch.reduce((s, n) => s + n, 0) / v.fileAch.length) * 10) / 10
          : null;
      return {
        item,
        sales: Math.round(v.sales),
        target: Math.round(v.target),
        achPct: computed,
        fileAchPct,
        isManual: v.manual,
      };
    })
    .sort((a, b) => {
      // Worst achievement first, the way every other list on the dashboard
      // is ordered. Items with no target sink to the bottom: they are not
      // failing, they are unplanned.
      const pa = a.achPct ?? Infinity;
      const pb = b.achPct ?? Infinity;
      if (pa !== pb) return pa - pb;
      return a.item.localeCompare(b.item);
    });

  // Tiles describe the focus month, like the item list under them — same
  // two sources as byMonth's own sum above, just narrowed to one month.
  const totalSales = focusActs.reduce((s, a) => s + a.value, 0) + focusTgts.reduce((s, t) => s + (t.salesValue ?? 0), 0);
  const totalTarget = focusTgts.reduce((s, t) => s + t.targetValue, 0);

  return {
    months,
    items,
    focusMonth,
    totalSales: Math.round(totalSales),
    totalTarget: Math.round(totalTarget),
    achPct: achievement(totalSales, totalTarget),
    mismatches: mismatches.sort((a, b) => a.label.localeCompare(b.label)),
  };
}

export type TeamMemberProgress = { rep: string; progress: Progress };

export type TeamProgress = Progress & {
  members: TeamMemberProgress[];
  /** Reps whose achievement is under the threshold, worst first. */
  belowTarget: string[];
  /** Reps with a target at all — the denominator of "3 of 5 below target". */
  measuredCount: number;
  /** Reps with no plan uploaded yet, named so the gap is visible. */
  unmeasured: string[];
};

/**
 * A manager's team, summed.
 *
 * Two rules, and both matter:
 *
 * The team's achievement is total sales over total target — NOT the
 * average of the reps' percentages. Averaging percentages weights a rep
 * with a small territory the same as one carrying half the district, which
 * is how a team lands "at 98%" while missing its number.
 *
 * And only reps who HAVE a plan are in those totals. Counting a rep's
 * sales while they have no target to divide by inflates the team: three
 * reps at 92%, 62% and no-plan-yet came out as 103%, which reads as a team
 * comfortably ahead rather than one that is two thirds measured. Reps
 * without a plan are named instead, so the gap is visible rather than
 * flattering.
 */
export function rollUpTeam(allMembers: TeamMemberProgress[], belowThreshold: number): TeamProgress {
  const members = allMembers.filter((m) => m.progress.totalTarget > 0);
  const unmeasured = allMembers.filter((m) => m.progress.totalTarget <= 0).map((m) => m.rep);

  const byMonth = new Map<number, { sales: number; target: number }>();
  for (const m of members) {
    for (const p of m.progress.months) {
      const cur = byMonth.get(p.month) ?? { sales: 0, target: 0 };
      cur.sales += p.sales;
      cur.target += p.target;
      byMonth.set(p.month, cur);
    }
  }
  const months: MonthProgress[] = [...byMonth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([month, v]) => ({ month, sales: v.sales, target: v.target, achPct: achievement(v.sales, v.target) }));

  const byItem = new Map<string, { sales: number; target: number; manual: boolean }>();
  for (const m of members) {
    for (const i of m.progress.items) {
      const cur = byItem.get(i.item) ?? { sales: 0, target: 0, manual: false };
      cur.sales += i.sales;
      cur.target += i.target;
      cur.manual = cur.manual || i.isManual;
      byItem.set(i.item, cur);
    }
  }
  const items: ItemProgress[] = [...byItem.entries()]
    .map(([item, v]) => ({
      item,
      sales: v.sales,
      target: v.target,
      achPct: achievement(v.sales, v.target),
      fileAchPct: null,
      isManual: v.manual,
    }))
    .sort((a, b) => {
      const pa = a.achPct ?? Infinity;
      const pb = b.achPct ?? Infinity;
      if (pa !== pb) return pa - pb;
      return a.item.localeCompare(b.item);
    });

  const totalSales = members.reduce((s, m) => s + m.progress.totalSales, 0);
  const totalTarget = members.reduce((s, m) => s + m.progress.totalTarget, 0);
  const focusMonth = members.find((m) => m.progress.focusMonth !== null)?.progress.focusMonth ?? null;

  const measured = members.filter((m) => m.progress.achPct !== null);
  const belowTarget = measured
    .filter((m) => m.progress.achPct! < belowThreshold)
    .sort((a, b) => a.progress.achPct! - b.progress.achPct!)
    .map((m) => m.rep);

  return {
    months,
    items,
    focusMonth,
    totalSales,
    totalTarget,
    achPct: achievement(totalSales, totalTarget),
    mismatches: members.flatMap((m) =>
      m.progress.mismatches.map((x) => ({ ...x, label: `${m.rep} · ${x.label}` })),
    ),
    members: allMembers,
    belowTarget,
    measuredCount: measured.length,
    unmeasured,
  };
}
