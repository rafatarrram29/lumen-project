// Territory decision engine — direct port of the Python prototype's
// engine.py. Same 5 rules, same thresholds, same finding shapes.
//
// Rule 1 (Trend): compare against the last 3 months, not one month, before
//   calling anything a real drop.
// Rule 2 (Systemic check): before blaming a single area, check whether ALL
//   areas moved together in the same direction. If so, the cause is
//   cluster-wide, not local.
// Rule 3 (Root cause): break each area's change down by product family to
//   find which family is actually driving the move.
// Rule 4 (Transfer opportunity): flag a family performing unusually well in
//   one area but not others, as a candidate to replicate.
// Rule 5 (Decision, not description): every finding ends in one concrete
//   action, never a bare observation.

export const FAMILY_PREFIXES = [
  "Glaryl",
  "Lezberg Plus",
  "Lezberg Amlo",
  "Lezberg",
  "Linajenta Plus",
  "Metacardia",
];

export function toFamily(itemName: string): string {
  for (const prefix of FAMILY_PREFIXES) {
    if (itemName.startsWith(prefix)) return prefix;
  }
  return itemName;
}

const SYSTEMIC_DROP_THRESHOLD = -15.0;
const SYSTEMIC_AREA_FRACTION = 0.6;
const TREND_DROP_STREAK = 3;
const TREND_CHART_MONTHS = 6;

export type SalesRecord = {
  area: string;
  family: string;
  salesValue: number;
  salesQty: number | null;
  month: number;
};

export type MonthPoint = { month: number; value: number; qty: number };

type AreaChange = {
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

type SystemicDropFinding = {
  type: "systemic_drop";
  summary: string;
  rootCauseFamily: string;
  rootCauseDetail: FamilyChange;
  allFamilies: Record<string, FamilyChange>;
  decision: string;
};

type LocalDropFinding = {
  type: "local_drop";
  area: string;
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
      isSystemicDrop: boolean;
      areas: Record<string, AreaChange>;
      familyChanges: Record<string, FamilyChange>;
      areaFamilyChanges: Record<string, Record<string, FamilyChange>>;
      clusterMonthlySeries: { month: number; avgValue: number }[];
      findings: Finding[];
    };

function pctChange(prev: number | null | undefined, curr: number): number | null {
  if (prev === null || prev === undefined || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100 * 10) / 10;
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

export function buildReport(records: SalesRecord[], year: number): Report {
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

  // Cluster-wide average monthly value, for the same chart window — lets
  // the UI plot any single area's trend against the cluster as a baseline.
  const clusterMonthlySeries = chartMonths.map((m) => {
    const valuesForMonth = Array.from(areaTotals.values())
      .map((months) => months.get(m)?.value)
      .filter((v): v is number => v !== undefined);
    const avgValue =
      valuesForMonth.length > 0
        ? Math.round(valuesForMonth.reduce((sum, v) => sum + v, 0) / valuesForMonth.length)
        : 0;
    return { month: m, avgValue };
  });

  // --- Rule 2: systemic check ---
  const droppingAreas = Object.entries(areaChanges)
    .filter(([, d]) => d.pctChange !== null && d.pctChange <= SYSTEMIC_DROP_THRESHOLD)
    .map(([a]) => a);
  const risingAreas = Object.entries(areaChanges)
    .filter(
      ([, d]) =>
        d.pctChange !== null &&
        d.pctChange >= -SYSTEMIC_DROP_THRESHOLD &&
        d.pctChange > 0,
    )
    .map(([a]) => a);
  const totalAreas = Object.keys(areaChanges).length;
  const isSystemicDrop =
    totalAreas > 0 && droppingAreas.length / totalAreas >= SYSTEMIC_AREA_FRACTION;

  const findings: Finding[] = [];

  // Cluster-wide family totals — computed unconditionally (not just when
  // systemic) so the UI can always show a family-vs-family comparison,
  // independent of which drop scenario (systemic or local) applies.
  const clusterFamily = new Map<string, [number, number]>();
  for (const [, famData] of familyTotals) {
    for (const [fam, months] of famData) {
      if (months.has(latest) && months.has(prev)) {
        const acc = clusterFamily.get(fam) ?? [0, 0];
        acc[0] += months.get(prev)!;
        acc[1] += months.get(latest)!;
        clusterFamily.set(fam, acc);
      }
    }
  }

  const familyChanges: Record<string, FamilyChange> = {};
  for (const [fam, [p, c]] of clusterFamily) {
    familyChanges[fam] = {
      prevValue: Math.round(p),
      currValue: Math.round(c),
      pctChange: pctChange(p, c),
      absDrop: Math.round(p - c),
    };
  }

  // Per-area family breakdown — computed unconditionally for every area
  // (not just dropping ones), so the UI can always show the full Rule 3
  // breakdown, not just the single worst family used to pick a finding.
  const areaFamilyChanges: Record<string, Record<string, FamilyChange>> = {};
  for (const [area, famData] of familyTotals) {
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

  // --- Rule 3: root cause, cluster-wide if systemic, else per-area ---
  if (isSystemicDrop) {
    const worstEntry = Object.entries(familyChanges).reduce((best, entry) =>
      entry[1].absDrop > best[1].absDrop ? entry : best,
    );

    findings.push({
      type: "systemic_drop",
      summary:
        `${droppingAreas.length} of ${totalAreas} areas dropped together ` +
        `from month ${prev} to ${latest} — this is a cluster-wide move, ` +
        `not an individual area failing.`,
      rootCauseFamily: worstEntry[0],
      rootCauseDetail: worstEntry[1],
      allFamilies: familyChanges,
      decision:
        `Investigate ${worstEntry[0]} specifically (stock availability, ` +
        `pricing change, competitor activity) before reviewing any single ` +
        `area's performance.`,
    });
  } else {
    for (const area of droppingAreas) {
      const famChanges = areaFamilyChanges[area];
      if (!famChanges || Object.keys(famChanges).length === 0) continue;

      const worst = Object.entries(famChanges).reduce((best, entry) =>
        entry[1].absDrop > best[1].absDrop ? entry : best,
      );

      findings.push({
        type: "local_drop",
        area,
        summary: `${area} dropped ${areaChanges[area].pctChange}% and did not move with the rest of the cluster.`,
        rootCauseFamily: worst[0],
        rootCauseDetail: worst[1],
        decision: `Review the ${worst[0]} visit plan and customer coverage specifically in ${area}.`,
      });
    }
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

  return {
    year,
    latestMonth: latest,
    comparedToMonth: prev,
    isSystemicDrop,
    areas: areaChanges,
    familyChanges,
    areaFamilyChanges,
    clusterMonthlySeries,
    findings,
  };
}
