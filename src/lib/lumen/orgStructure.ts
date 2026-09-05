// The org chart: District Manager -> reps -> the areas each rep covers.
//
// Display-layer only, exactly like rep assignments (see repAssignments.ts).
// None of this feeds engine.ts's maths — an area's trend, systemic check
// and root cause are computed the same way whether or not anyone has drawn
// an org chart. Adding structure can only ever add context to what is
// already there; it can never change a number.
//
// The two halves come from two different places on purpose:
//
//   who covers which area   lumen_rep_assignments, per month — the table
//                           the per-area "+ Add period" control has always
//                           written. The bulk assign screen writes the
//                           same rows.
//   who reports to whom     lumen_district_managers, this feature's only
//                           new table.

import type { RepAssignment } from "./repAssignments";

/** One rep reporting to one manager, for a dataset and year. */
export type ManagerLink = {
  id: string;
  manager: string;
  rep: string;
};

export type OrgArea = {
  area: string;
  /** Months of the year this rep covered it, from the assignment rows. */
  months: number[];
  /** Latest-month sales value for the area, or null if it has none. */
  currValue: number | null;
  pctChange: number | null;
  /**
   * Whether this rep still held the area in the month being reported.
   *
   * An area handed over mid-year still belongs in the rep's history — it
   * is shown, with the months they had it. It must NOT be added to their
   * total: the figures are the latest month's, and in that month somebody
   * else was selling it.
   */
  currentlyHeld: boolean;
};

export type OrgRep = {
  rep: string;
  areas: OrgArea[];
  /** Latest-month value across the areas this rep still holds. */
  totalValue: number;
};

export type OrgManager = {
  manager: string;
  reps: OrgRep[];
  repCount: number;
  totalValue: number;
};

/** The manager a rep reports to, or null when nobody has said. */
export function managerForRep(links: ManagerLink[], rep: string | null): string | null {
  if (!rep) return null;
  return links.find((l) => l.rep === rep)?.manager ?? null;
}

/** Every distinct rep named anywhere — assignments, links, or the sales data. */
export function knownReps(assignments: RepAssignment[], links: ManagerLink[], fromSales: string[]): string[] {
  const names = new Set<string>();
  for (const a of assignments) if (a.rep) names.add(a.rep);
  for (const l of links) names.add(l.rep);
  for (const r of fromSales) if (r) names.add(r);
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Every distinct manager named so far. */
export function knownManagers(links: ManagerLink[]): string[] {
  return [...new Set(links.map((l) => l.manager))].sort((a, b) => a.localeCompare(b));
}

/**
 * The areas a rep covers, with the months they cover them for.
 *
 * A rep can hold several areas, and can hold the same area over more than
 * one stretch of the year (handed over and handed back). Those stretches
 * are merged into one entry per area so the org chart shows each area once.
 */
export function areasForRep(assignments: RepAssignment[], rep: string): { area: string; months: number[] }[] {
  const byArea = new Map<string, Set<number>>();
  for (const a of assignments) {
    if (a.rep !== rep) continue;
    const months = byArea.get(a.area) ?? new Set<number>();
    for (let m = a.startMonth; m <= a.endMonth; m++) months.add(m);
    byArea.set(a.area, months);
  }
  return [...byArea.entries()]
    .map(([area, months]) => ({ area, months: [...months].sort((x, y) => x - y) }))
    .sort((x, y) => x.area.localeCompare(y.area));
}

/**
 * The whole chart, ready to render.
 *
 * `areaFigures` is the engine's per-area result — passed in rather than
 * recomputed, so a manager's total is the sum of exactly the numbers shown
 * on the area cards and can never drift from them.
 *
 * Reps with a manager but no areas still appear (a new hire, or a
 * reorganisation half done), showing zero rather than vanishing.
 */
export function buildOrgChart(
  links: ManagerLink[],
  assignments: RepAssignment[],
  areaFigures: Record<string, { currValue: number; pctChange: number | null }>,
  /**
   * The month the figures describe. Areas a rep no longer held that month
   * are listed but contribute nothing to their total. Omit it and every
   * area counts, which is the right answer when there is no month to
   * compare against.
   */
  latestMonth?: number | null,
): OrgManager[] {
  const byManager = new Map<string, Set<string>>();
  for (const link of links) {
    const reps = byManager.get(link.manager) ?? new Set<string>();
    reps.add(link.rep);
    byManager.set(link.manager, reps);
  }

  const managers: OrgManager[] = [];
  for (const [manager, repNames] of byManager) {
    const reps: OrgRep[] = [...repNames]
      .sort((a, b) => a.localeCompare(b))
      .map((rep) => {
        const areas: OrgArea[] = areasForRep(assignments, rep).map(({ area, months }) => ({
          area,
          months,
          currValue: areaFigures[area]?.currValue ?? null,
          pctChange: areaFigures[area]?.pctChange ?? null,
          currentlyHeld: latestMonth == null || months.includes(latestMonth),
        }));
        return {
          rep,
          areas,
          totalValue: areas.reduce((sum, a) => sum + (a.currentlyHeld ? (a.currValue ?? 0) : 0), 0),
        };
      });

    managers.push({
      manager,
      reps,
      repCount: reps.length,
      totalValue: reps.reduce((sum, r) => sum + r.totalValue, 0),
    });
  }

  // Biggest team total first, ties alphabetical — a fixed order, so the
  // cards don't rearrange themselves between loads.
  return managers.sort((a, b) => b.totalValue - a.totalValue || a.manager.localeCompare(b.manager));
}

/** Every area covered by anyone under this manager, deduplicated. */
export function areasUnderManager(manager: OrgManager): string[] {
  const areas = new Set<string>();
  for (const rep of manager.reps) for (const a of rep.areas) areas.add(a.area);
  return [...areas].sort((a, b) => a.localeCompare(b));
}
