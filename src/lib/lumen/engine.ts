// Territory decision engine — generic version. Same 5 rules as the
// original Python prototype's engine.py, but with no assumptions baked in
// about column names, product families, or area names: everything comes
// from the records the caller passes in, shaped by that dataset's own
// column mapping.
//
// Rule 1 (Trend): compare against the last 3 months, not one month, before
//   calling anything a real drop.
// Rule 2 (Systemic check): before blaming a single area, check whether ALL
//   areas moved together in the same direction. If the dataset has a
//   cluster column, this check runs separately inside each cluster; with
//   no cluster column, every area is treated as one cluster (the original
//   behavior).
// Rule 3 (Root cause): break each area's change down by item to find which
//   one is actually driving the move.
// Rule 4 (Transfer opportunity): flag an item performing unusually well in
//   one area but not others, as a candidate to replicate.
// Rule 5 (Decision, not description): every finding ends in one concrete
//   action, never a bare observation.

const SYSTEMIC_DROP_THRESHOLD = -15.0;
const SYSTEMIC_AREA_FRACTION = 0.6;
const TREND_DROP_STREAK = 3;
const TREND_CHART_MONTHS = 6;
export const DEFAULT_CLUSTER = "All areas";

export type SalesRecord = {
  area: string;
  family: string;
  salesValue: number;
  salesQty: number | null;
  month: number;
  cluster: string | null;
  rep: string | null;
};

export type MonthPoint = { month: number; value: number; qty: number };

export type TargetRecord = {
  area: string | null;
  rep: string | null;
  item: string | null;
  month: number;
  targetValue: number;
};

export type TargetProgress = { targetValue: number; pctOfTarget: number | null };

type AreaChange = {
  cluster: string;
  prevValue: number;
  currValue: number;
  prevQty: number;
  currQty: number;
  pctChange: number | null;
  decliningStreak: boolean;
  monthsInStreak: number;
  monthlySeries: MonthPoint[];
};

export type FamilyChange = {
  prevValue: number;
  currValue: number;
  pctChange: number | null;
  absDrop: number;
};

export type ClusterSummary = {
  label: string;
  totalAreas: number;
  isSystemicDrop: boolean;
  monthlySeries: { month: number; avgValue: number }[];
};

type SystemicDropFinding = {
  type: "systemic_drop";
  cluster: string;
  droppingCount: number;
  totalAreas: number;
  summary: string;
  rootCauseFamily: string;
  rootCauseDetail: FamilyChange;
  allFamilies: Record<string, FamilyChange>;
  decision: string;
};

type LocalDropFinding = {
  type: "local_drop";
  area: string;
  pctChange: number | null;
  summary: string;
  rootCauseFamily: string;
  rootCauseDetail: { pctChange: number | null; absDrop: number };
  decision: string;
};

type TransferOpportunityFinding = {
  type: "transfer_opportunity";
  area: string;
  family: string;
  pctChange: number;
  summary: string;
  decision: string;
};

export type Finding = SystemicDropFinding | LocalDropFinding | TransferOpportunityFinding;

export type Report =
  | { error: string }
  | {
      year: number;
      latestMonth: number;
      comparedToMonth: number;
      hasClusters: boolean;
      isSystemicDrop: boolean;
      areas: Record<string, AreaChange>;
      clusters: Record<string, ClusterSummary>;
      familyChanges: Record<string, FamilyChange>;
      areaFamilyChanges: Record<string, Record<string, FamilyChange>>;
      itemMonthlySeries: Record<string, MonthPoint[]>;
      findings: Finding[];
      hasReps: boolean;
      repChanges: Record<string, FamilyChange>;
      repMonthlySeries: Record<string, MonthPoint[]>;
      repAverageSeries: { month: number; avgValue: number }[];
      hasTargets: boolean;
      areaTargets: Record<string, TargetProgress>;
      repTargets: Record<string, TargetProgress>;
    };

function pctChange(prev: number | null | undefined, curr: number): number | null {
  if (prev === null || prev === undefined || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100 * 10) / 10;
}

function clusterKeyFor(cluster: string | null | undefined): string {
  return cluster && cluster.trim() !== "" ? cluster : DEFAULT_CLUSTER;
}

type MonthTotal = { value: number; qty: number };

function groupAreaMonthTotals(records: SalesRecord[]): Map<string, Map<number, MonthTotal>> {
  const data = new Map<string, Map<number, MonthTotal>>();
  for (const r of records) {
    if (!data.has(r.area)) data.set(r.area, new Map());
    const months = data.get(r.area)!;
    const existing = months.get(r.month) ?? { value: 0, qty: 0 };
    months.set(r.month, {
      value: existing.value + r.salesValue,
      qty: existing.qty + (r.salesQty ?? 0),
    });
  }
  return data;
}

function groupRepMonthTotals(records: SalesRecord[]): Map<string, Map<number, MonthTotal>> {
  const data = new Map<string, Map<number, MonthTotal>>();
  for (const r of records) {
    if (!r.rep) continue;
    if (!data.has(r.rep)) data.set(r.rep, new Map());
    const months = data.get(r.rep)!;
    const existing = months.get(r.month) ?? { value: 0, qty: 0 };
    months.set(r.month, {
      value: existing.value + r.salesValue,
      qty: existing.qty + (r.salesQty ?? 0),
    });
  }
  return data;
}

function groupFamilyMonthTotals(records: SalesRecord[]): Map<string, Map<number, MonthTotal>> {
  const data = new Map<string, Map<number, MonthTotal>>();
  for (const r of records) {
    if (!data.has(r.family)) data.set(r.family, new Map());
    const months = data.get(r.family)!;
    const existing = months.get(r.month) ?? { value: 0, qty: 0 };
    months.set(r.month, {
      value: existing.value + r.salesValue,
      qty: existing.qty + (r.salesQty ?? 0),
    });
  }
  return data;
}

function groupAreaFamilyMonthTotals(
  records: SalesRecord[],
): Map<string, Map<string, Map<number, number>>> {
  const data = new Map<string, Map<string, Map<number, number>>>();
  for (const r of records) {
    if (!data.has(r.area)) data.set(r.area, new Map());
    const families = data.get(r.area)!;
    if (!families.has(r.family)) families.set(r.family, new Map());
    const months = families.get(r.family)!;
    months.set(r.month, (months.get(r.month) ?? 0) + r.salesValue);
  }
  return data;
}

function familyTotalsFor(
  areas: Iterable<string>,
  familyTotals: Map<string, Map<string, Map<number, number>>>,
  prev: number,
  latest: number,
): Record<string, FamilyChange> {
  const acc = new Map<string, [number, number]>();
  for (const area of areas) {
    const famData = familyTotals.get(area);
    if (!famData) continue;
    for (const [fam, months] of famData) {
      if (months.has(latest) && months.has(prev)) {
        const entry = acc.get(fam) ?? [0, 0];
        entry[0] += months.get(prev)!;
        entry[1] += months.get(latest)!;
        acc.set(fam, entry);
      }
    }
  }
  const result: Record<string, FamilyChange> = {};
  for (const [fam, [p, c]] of acc) {
    result[fam] = {
      prevValue: Math.round(p),
      currValue: Math.round(c),
      pctChange: pctChange(p, c),
      absDrop: Math.round(p - c),
    };
  }
  return result;
}

export function buildReport(records: SalesRecord[], year: number, targets: TargetRecord[] = []): Report {
  if (records.length === 0) {
    return { error: `No data found for year ${year}.` };
  }

  const areaTotals = groupAreaMonthTotals(records);
  const familyTotals = groupAreaFamilyMonthTotals(records);

  const allMonths = Array.from(
    new Set(records.map((r) => r.month)),
  ).sort((a, b) => a - b);

  if (allMonths.length < 2) {
    return { error: "Need at least 2 months of data to compare." };
  }

  const latest = allMonths[allMonths.length - 1];
  const prev = allMonths[allMonths.length - 2];
  const lastN =
    allMonths.length >= TREND_DROP_STREAK
      ? allMonths.slice(allMonths.length - TREND_DROP_STREAK)
      : allMonths;
  const chartMonths =
    allMonths.length >= TREND_CHART_MONTHS
      ? allMonths.slice(allMonths.length - TREND_CHART_MONTHS)
      : allMonths;

  // Each area's cluster is whatever cluster label its rows carry (assumed
  // consistent per area). No cluster column at all -> everyone shares the
  // single default cluster, which reproduces the original ungrouped
  // behavior exactly.
  const areaCluster = new Map<string, string>();
  let hasClusters = false;
  for (const r of records) {
    if (r.cluster && r.cluster.trim() !== "") hasClusters = true;
    if (!areaCluster.has(r.area)) areaCluster.set(r.area, clusterKeyFor(r.cluster));
  }

  // --- Rule 1 + area-level change ---
  const areaChanges: Record<string, AreaChange> = {};
  for (const [area, months] of areaTotals) {
    const curr = months.get(latest);
    const prevTotal = months.get(prev);
    if (curr === undefined || prevTotal === undefined) continue;

    const change = pctChange(prevTotal.value, curr.value);
    const trendVals = lastN.filter((m) => months.has(m)).map((m) => months.get(m)!.value);
    const decliningStreak =
      trendVals.length >= 2 &&
      trendVals.every((v, i) => i === trendVals.length - 1 || v > trendVals[i + 1]);

    const monthlySeries: MonthPoint[] = chartMonths
      .filter((m) => months.has(m))
      .map((m) => {
        const t = months.get(m)!;
        return { month: m, value: Math.round(t.value), qty: Math.round(t.qty) };
      });

    areaChanges[area] = {
      cluster: areaCluster.get(area) ?? DEFAULT_CLUSTER,
      prevValue: Math.round(prevTotal.value),
      currValue: Math.round(curr.value),
      prevQty: Math.round(prevTotal.qty),
      currQty: Math.round(curr.qty),
      pctChange: change,
      decliningStreak,
      monthsInStreak: trendVals.length,
      monthlySeries,
    };
  }

  // Areas grouped by cluster (only areas that made it into areaChanges).
  const areasByCluster = new Map<string, string[]>();
  for (const [area, d] of Object.entries(areaChanges)) {
    const list = areasByCluster.get(d.cluster) ?? [];
    list.push(area);
    areasByCluster.set(d.cluster, list);
  }

  // --- Rule 2: systemic check, scoped to each cluster ---
  const clusters: Record<string, ClusterSummary> = {};
  const droppingAreasByCluster = new Map<string, string[]>();
  let anySystemicDrop = false;

  for (const [clusterLabel, areasInCluster] of areasByCluster) {
    const dropping = areasInCluster.filter((a) => {
      const p = areaChanges[a].pctChange;
      return p !== null && p <= SYSTEMIC_DROP_THRESHOLD;
    });
    droppingAreasByCluster.set(clusterLabel, dropping);

    const totalAreas = areasInCluster.length;
    const isSystemicDrop =
      totalAreas > 0 && dropping.length / totalAreas >= SYSTEMIC_AREA_FRACTION;
    if (isSystemicDrop) anySystemicDrop = true;

    const monthlySeries = chartMonths.map((m) => {
      const valuesForMonth = areasInCluster
        .map((a) => areaTotals.get(a)?.get(m)?.value)
        .filter((v): v is number => v !== undefined);
      const avgValue =
        valuesForMonth.length > 0
          ? Math.round(valuesForMonth.reduce((sum, v) => sum + v, 0) / valuesForMonth.length)
          : 0;
      return { month: m, avgValue };
    });

    clusters[clusterLabel] = { label: clusterLabel, totalAreas, isSystemicDrop, monthlySeries };
  }

  // Rising areas — used by rule 4 only, which is independent of cluster
  // grouping (it's a per-area, per-item signal, not a cluster-wide one).
  const risingAreas = Object.entries(areaChanges)
    .filter(
      ([, d]) =>
        d.pctChange !== null &&
        d.pctChange >= -SYSTEMIC_DROP_THRESHOLD &&
        d.pctChange > 0,
    )
    .map(([a]) => a);

  const findings: Finding[] = [];

  // Cluster-wide (global) family totals — computed unconditionally so the
  // UI can always show a family-vs-family overview, independent of which
  // drop scenario applies anywhere.
  const familyChanges = familyTotalsFor(Object.keys(areaChanges), familyTotals, prev, latest);

  // Per-area family breakdown — computed unconditionally for every area.
  const areaFamilyChanges: Record<string, Record<string, FamilyChange>> = {};
  for (const [area, famData] of familyTotals) {
    if (!(area in areaChanges)) continue;
    const famChanges: Record<string, FamilyChange> = {};
    for (const [fam, months] of famData) {
      if (months.has(latest) && months.has(prev)) {
        const p = months.get(prev)!;
        const c = months.get(latest)!;
        famChanges[fam] = {
          prevValue: Math.round(p),
          currValue: Math.round(c),
          pctChange: pctChange(p, c),
          absDrop: Math.round(p - c),
        };
      }
    }
    if (Object.keys(famChanges).length > 0) areaFamilyChanges[area] = famChanges;
  }

  // --- Rule 3: root cause, per cluster (cluster-wide if that cluster is
  // systemic, else per dropping area within it) ---
  for (const [clusterLabel, areasInCluster] of areasByCluster) {
    const summary = clusters[clusterLabel];
    const dropping = droppingAreasByCluster.get(clusterLabel) ?? [];

    if (summary.isSystemicDrop) {
      const clusterFamilies = familyTotalsFor(areasInCluster, familyTotals, prev, latest);
      const entries = Object.entries(clusterFamilies);
      if (entries.length === 0) continue;
      const worstEntry = entries.reduce((best, entry) =>
        entry[1].absDrop > best[1].absDrop ? entry : best,
      );

      findings.push({
        type: "systemic_drop",
        cluster: clusterLabel,
        droppingCount: dropping.length,
        totalAreas: summary.totalAreas,
        summary:
          `${dropping.length} of ${summary.totalAreas} areas` +
          (clusterLabel === DEFAULT_CLUSTER ? "" : ` in ${clusterLabel}`) +
          ` dropped together from month ${prev} to ${latest} — this is a cluster-wide move, ` +
          `not an individual area failing.`,
        rootCauseFamily: worstEntry[0],
        rootCauseDetail: worstEntry[1],
        allFamilies: clusterFamilies,
        decision:
          `Investigate ${worstEntry[0]} specifically (stock availability, ` +
          `pricing change, competitor activity) before reviewing any single ` +
          `area's performance.`,
      });
    } else {
      for (const area of dropping) {
        const famChanges = areaFamilyChanges[area];
        if (!famChanges || Object.keys(famChanges).length === 0) continue;

        const worst = Object.entries(famChanges).reduce((best, entry) =>
          entry[1].absDrop > best[1].absDrop ? entry : best,
        );

        findings.push({
          type: "local_drop",
          area,
          pctChange: areaChanges[area].pctChange,
          summary: `${area} dropped ${areaChanges[area].pctChange}% and did not move with the rest of the cluster.`,
          rootCauseFamily: worst[0],
          rootCauseDetail: worst[1],
          decision: `Review the ${worst[0]} visit plan and customer coverage specifically in ${area}.`,
        });
      }
    }
  }

  // Per-item monthly series, across all areas — lets the UI show an
  // item's own trend line independent of which area's breakdown it was
  // clicked from.
  const familyMonthTotals = groupFamilyMonthTotals(records);
  const itemMonthlySeries: Record<string, MonthPoint[]> = {};
  for (const [fam, months] of familyMonthTotals) {
    const series = chartMonths
      .filter((m) => months.has(m))
      .map((m) => {
        const t = months.get(m)!;
        return { month: m, value: Math.round(t.value), qty: Math.round(t.qty) };
      });
    if (series.length > 0) itemMonthlySeries[fam] = series;
  }

  // --- Rule 4: transfer opportunity ---
  for (const area of risingAreas) {
    const famData = familyTotals.get(area);
    if (!famData) continue;

    for (const [fam, months] of famData) {
      if (months.has(latest) && months.has(prev)) {
        const change = pctChange(months.get(prev)!, months.get(latest)!);
        if (change && change > 10) {
          findings.push({
            type: "transfer_opportunity",
            area,
            family: fam,
            pctChange: change,
            summary: `${fam} grew ${change}% in ${area} while the cluster overall declined.`,
            decision: `Review what worked for ${fam} in ${area} and check whether the same approach applies to similar customers in other areas.`,
          });
        }
      }
    }
  }

  // --- Rep dimension (optional, fully independent of area/item findings
  // above): per-rep trend + an all-reps average series so the UI can show
  // each rep against their peers the same way areas are shown against
  // their cluster. ---
  const repTotals = groupRepMonthTotals(records);
  const hasReps = repTotals.size > 0;
  const repChanges: Record<string, FamilyChange> = {};
  const repMonthlySeries: Record<string, MonthPoint[]> = {};
  for (const [rep, months] of repTotals) {
    const curr = months.get(latest);
    const prevTotal = months.get(prev);
    if (curr !== undefined && prevTotal !== undefined) {
      repChanges[rep] = {
        prevValue: Math.round(prevTotal.value),
        currValue: Math.round(curr.value),
        pctChange: pctChange(prevTotal.value, curr.value),
        absDrop: Math.round(prevTotal.value - curr.value),
      };
    }
    const series = chartMonths
      .filter((m) => months.has(m))
      .map((m) => {
        const t = months.get(m)!;
        return { month: m, value: Math.round(t.value), qty: Math.round(t.qty) };
      });
    if (series.length > 0) repMonthlySeries[rep] = series;
  }
  const repAverageSeries = chartMonths.map((m) => {
    const valuesForMonth = Array.from(repTotals.values())
      .map((months) => months.get(m)?.value)
      .filter((v): v is number => v !== undefined);
    const avgValue =
      valuesForMonth.length > 0
        ? Math.round(valuesForMonth.reduce((sum, v) => sum + v, 0) / valuesForMonth.length)
        : 0;
    return { month: m, avgValue };
  });

  // --- Targets vs Actual (optional; empty when no targets file was
  // uploaded for this dataset). Only the latest month is compared against
  // its target — a target row attributes to an area and/or a rep whenever
  // that dimension is set on it, so the same row can count toward both. ---
  const hasTargets = targets.some((t) => t.month === latest);
  const areaTargetTotals = new Map<string, number>();
  const repTargetTotals = new Map<string, number>();
  for (const t of targets) {
    if (t.month !== latest) continue;
    if (t.area) areaTargetTotals.set(t.area, (areaTargetTotals.get(t.area) ?? 0) + t.targetValue);
    if (t.rep) repTargetTotals.set(t.rep, (repTargetTotals.get(t.rep) ?? 0) + t.targetValue);
  }
  const areaTargets: Record<string, TargetProgress> = {};
  for (const [area, targetValue] of areaTargetTotals) {
    const actual = areaChanges[area]?.currValue;
    areaTargets[area] = {
      targetValue: Math.round(targetValue),
      pctOfTarget: actual !== undefined && targetValue > 0 ? Math.round((actual / targetValue) * 1000) / 10 : null,
    };
  }
  const repTargets: Record<string, TargetProgress> = {};
  for (const [rep, targetValue] of repTargetTotals) {
    const actual = repChanges[rep]?.currValue;
    repTargets[rep] = {
      targetValue: Math.round(targetValue),
      pctOfTarget: actual !== undefined && targetValue > 0 ? Math.round((actual / targetValue) * 1000) / 10 : null,
    };
  }

  return {
    year,
    latestMonth: latest,
    comparedToMonth: prev,
    hasClusters,
    isSystemicDrop: anySystemicDrop,
    areas: areaChanges,
    clusters,
    familyChanges,
    areaFamilyChanges,
    itemMonthlySeries,
    findings,
    hasReps,
    repChanges,
    repMonthlySeries,
    repAverageSeries,
    hasTargets,
    areaTargets,
    repTargets,
  };
}
