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
//   line column, this check runs separately inside each line; with
//   no line column, every area is treated as one line (the original
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
export const DEFAULT_LINE = "All areas";

export type SalesRecord = {
  area: string;
  family: string;
  salesValue: number;
  salesQty: number | null;
  month: number;
  line: string | null;
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
  line: string;
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

export type LineSummary = {
  label: string;
  totalAreas: number;
  isSystemicDrop: boolean;
  monthlySeries: { month: number; avgValue: number }[];
};

type SystemicDropFinding = {
  type: "systemic_drop";
  line: string;
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
      hasLines: boolean;
      isSystemicDrop: boolean;
      areas: Record<string, AreaChange>;
      lines: Record<string, LineSummary>;
      familyChanges: Record<string, FamilyChange>;
      areaFamilyChanges: Record<string, Record<string, FamilyChange>>;
      itemMonthlySeries: Record<string, MonthPoint[]>;
      findings: Finding[];
      // Whether the uploaded file actually carried a quantity column with
      // real numbers in it. Item charts plot UNITS when it did and fall
      // back to money when it didn't — the reader has to be told which,
      // because the two are not remotely interchangeable.
      hasQuantity: boolean;
      hasReps: boolean;
      repChanges: Record<string, FamilyChange>;
      repMonthlySeries: Record<string, MonthPoint[]>;
      repAverageSeries: { month: number; avgValue: number }[];
      hasTargets: boolean;
      areaTargets: Record<string, TargetProgress>;
      repTargets: Record<string, TargetProgress>;
      // Set when a targets file was uploaded but none of it covers the
      // latest sales month, so there is nothing to compare against and the
      // whole Target vs Actual section silently disappears. Null whenever
      // there is nothing to warn about (no targets at all, or targets that
      // do cover the latest month).
      targetMonthMismatch: { targetMonths: number[]; latestMonth: number } | null;
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

// A comparison entity (item, area, rep) that has data for only ONE of the
// two months being compared — a brand-new item's first month, or one that
// stopped selling entirely — used to be silently dropped from every
// comparison list (both months were required), which is exactly why a
// dataset with several genuinely new/discontinued items could show far
// fewer rows than the number of distinct items actually in the file. The
// missing side is treated as 0 instead: pctChange is correctly null (no
// percentage is defined starting or ending at zero — see pctChange above),
// but prevValue/currValue/absDrop still carry the real number, and the UI
// can show it as "New" or "Stopped" rather than making it disappear.
// Returns null only when there is truly no data for EITHER month.
function changeFor(prevTotal: number | undefined, currTotal: number | undefined): FamilyChange | null {
  if (prevTotal === undefined && currTotal === undefined) return null;
  const p = prevTotal ?? 0;
  const c = currTotal ?? 0;
  return {
    prevValue: Math.round(p),
    currValue: Math.round(c),
    pctChange: pctChange(p, c),
    absDrop: Math.round(p - c),
  };
}

function familyTotalsFor(
  areas: Iterable<string>,
  familyTotals: Map<string, Map<string, Map<number, number>>>,
  prev: number,
  latest: number,
): Record<string, FamilyChange> {
  const acc = new Map<string, [number | undefined, number | undefined]>();
  for (const area of areas) {
    const famData = familyTotals.get(area);
    if (!famData) continue;
    for (const [fam, months] of famData) {
      if (!months.has(latest) && !months.has(prev)) continue;
      const entry = acc.get(fam) ?? [undefined, undefined];
      const prevVal = months.get(prev);
      const currVal = months.get(latest);
      if (prevVal !== undefined) entry[0] = (entry[0] ?? 0) + prevVal;
      if (currVal !== undefined) entry[1] = (entry[1] ?? 0) + currVal;
      acc.set(fam, entry);
    }
  }
  const result: Record<string, FamilyChange> = {};
  for (const [fam, [p, c]] of acc) {
    const change = changeFor(p, c);
    if (change) result[fam] = change;
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

  // Each area's line is whatever line label its rows carry. They should all
  // agree, but a mis-keyed file can disagree — and taking whichever row
  // happened to arrive first made the entire report depend on row order,
  // which is not something the caller can guarantee. Take the most common
  // label instead, ties broken alphabetically, and never let a blank line
  // outvote a real one. No line column at all -> everyone shares the single
  // default line, which reproduces the original ungrouped behavior exactly.
  const lineVotes = new Map<string, Map<string, number>>();
  let hasLines = false;
  for (const r of records) {
    const label = r.line && r.line.trim() !== "" ? r.line : null;
    if (label) hasLines = true;
    if (!lineVotes.has(r.area)) lineVotes.set(r.area, new Map());
    if (label) {
      const votes = lineVotes.get(r.area)!;
      votes.set(label, (votes.get(label) ?? 0) + 1);
    }
  }
  const areaLine = new Map<string, string>();
  for (const [area, votes] of lineVotes) {
    const winner = Array.from(votes.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0];
    areaLine.set(area, winner ? winner[0] : DEFAULT_LINE);
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
      line: areaLine.get(area) ?? DEFAULT_LINE,
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

  // Areas grouped by line (only areas that made it into areaChanges).
  // Both the areas inside a line and the lines themselves are sorted, so
  // findings come out in the same order no matter what order the rows
  // arrived in — see the comment above `orderedLines`.
  const areasByLine = new Map<string, string[]>();
  for (const [area, d] of Object.entries(areaChanges)) {
    const list = areasByLine.get(d.line) ?? [];
    list.push(area);
    areasByLine.set(d.line, list);
  }
  for (const list of areasByLine.values()) list.sort((a, b) => a.localeCompare(b));

  // Rows come back from Postgres in pages fetched in parallel, so their
  // order is arbitrary. Every loop below that appends to `findings` walks
  // this sorted list rather than a Map's insertion order, so the same data
  // always produces the same report in the same order — which is what makes
  // a report reproducible, diffable, and safe to cache.
  const orderedLines = Array.from(areasByLine.keys()).sort((a, b) => a.localeCompare(b));

  // --- Rule 2: systemic check, scoped to each line ---
  const lines: Record<string, LineSummary> = {};
  const droppingAreasByLine = new Map<string, string[]>();
  let anySystemicDrop = false;

  for (const lineLabel of orderedLines) {
    const areasInLine = areasByLine.get(lineLabel)!;
    const dropping = areasInLine.filter((a) => {
      const p = areaChanges[a].pctChange;
      return p !== null && p <= SYSTEMIC_DROP_THRESHOLD;
    });
    droppingAreasByLine.set(lineLabel, dropping);

    const totalAreas = areasInLine.length;
    const isSystemicDrop =
      totalAreas > 0 && dropping.length / totalAreas >= SYSTEMIC_AREA_FRACTION;
    if (isSystemicDrop) anySystemicDrop = true;

    const monthlySeries = chartMonths.map((m) => {
      const valuesForMonth = areasInLine
        .map((a) => areaTotals.get(a)?.get(m)?.value)
        .filter((v): v is number => v !== undefined);
      const avgValue =
        valuesForMonth.length > 0
          ? Math.round(valuesForMonth.reduce((sum, v) => sum + v, 0) / valuesForMonth.length)
          : 0;
      return { month: m, avgValue };
    });

    lines[lineLabel] = { label: lineLabel, totalAreas, isSystemicDrop, monthlySeries };
  }

  // Rising areas — used by rule 4 only, which is independent of line
  // grouping (it's a per-area, per-item signal, not a line-wide one).
  const risingAreas = Object.entries(areaChanges)
    .filter(
      ([, d]) =>
        d.pctChange !== null &&
        d.pctChange >= -SYSTEMIC_DROP_THRESHOLD &&
        d.pctChange > 0,
    )
    .map(([a]) => a)
    .sort((a, b) => a.localeCompare(b));

  const findings: Finding[] = [];

  // Line-wide (global) family totals — computed unconditionally so the
  // UI can always show a family-vs-family overview, independent of which
  // drop scenario applies anywhere.
  const familyChanges = familyTotalsFor(Object.keys(areaChanges), familyTotals, prev, latest);

  // Per-area family breakdown — computed unconditionally for every area.
  const areaFamilyChanges: Record<string, Record<string, FamilyChange>> = {};
  for (const [area, famData] of familyTotals) {
    if (!(area in areaChanges)) continue;
    const famChanges: Record<string, FamilyChange> = {};
    for (const [fam, months] of famData) {
      const change = changeFor(months.get(prev), months.get(latest));
      if (change) famChanges[fam] = change;
    }
    if (Object.keys(famChanges).length > 0) areaFamilyChanges[area] = famChanges;
  }

  // --- Rule 3: root cause, per line (line-wide if that line is
  // systemic, else per dropping area within it) ---
  for (const lineLabel of orderedLines) {
    const areasInLine = areasByLine.get(lineLabel)!;
    const summary = lines[lineLabel];
    const dropping = droppingAreasByLine.get(lineLabel) ?? [];

    if (summary.isSystemicDrop) {
      const lineFamilies = familyTotalsFor(areasInLine, familyTotals, prev, latest);
      // Sorted first so that two items losing exactly the same amount
      // resolve to the same one every time, rather than to whichever was
      // read first.
      const entries = Object.entries(lineFamilies).sort((a, b) => a[0].localeCompare(b[0]));
      if (entries.length === 0) continue;
      const worstEntry = entries.reduce((best, entry) =>
        entry[1].absDrop > best[1].absDrop ? entry : best,
      );

      findings.push({
        type: "systemic_drop",
        line: lineLabel,
        droppingCount: dropping.length,
        totalAreas: summary.totalAreas,
        summary:
          `${dropping.length} of ${summary.totalAreas} areas` +
          (lineLabel === DEFAULT_LINE ? "" : ` in ${lineLabel}`) +
          ` dropped together from month ${prev} to ${latest} — this is a line-wide move, ` +
          `not an individual area failing.`,
        rootCauseFamily: worstEntry[0],
        rootCauseDetail: worstEntry[1],
        allFamilies: lineFamilies,
        decision:
          `Investigate ${worstEntry[0]} specifically (stock availability, ` +
          `pricing change, competitor activity) before reviewing any single ` +
          `area's performance.`,
      });
    } else {
      for (const area of dropping) {
        const famChanges = areaFamilyChanges[area];
        if (!famChanges || Object.keys(famChanges).length === 0) continue;

        const worst = Object.entries(famChanges)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .reduce((best, entry) => (entry[1].absDrop > best[1].absDrop ? entry : best));

        findings.push({
          type: "local_drop",
          area,
          pctChange: areaChanges[area].pctChange,
          summary: `${area} dropped ${areaChanges[area].pctChange}% and did not move with the rest of the line.`,
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

    const orderedFamilies = Array.from(famData.keys()).sort((a, b) => a.localeCompare(b));
    for (const fam of orderedFamilies) {
      const months = famData.get(fam)!;
      if (months.has(latest) && months.has(prev)) {
        const change = pctChange(months.get(prev)!, months.get(latest)!);
        if (change && change > 10) {
          findings.push({
            type: "transfer_opportunity",
            area,
            family: fam,
            pctChange: change,
            summary: `${fam} grew ${change}% in ${area} while the line overall declined.`,
            decision: `Review what worked for ${fam} in ${area} and check whether the same approach applies to similar customers in other areas.`,
          });
        }
      }
    }
  }

  // --- Rep dimension (optional, fully independent of area/item findings
  // above): per-rep trend + an all-reps average series so the UI can show
  // each rep against their peers the same way areas are shown against
  // their line. ---
  // A dataset with no quantity column parses every row's salesQty as null;
  // one row with a real number anywhere is enough to plot units.
  const hasQuantity = records.some((r) => r.salesQty !== null && r.salesQty !== undefined);

  const repTotals = groupRepMonthTotals(records);
  const hasReps = repTotals.size > 0;
  const repChanges: Record<string, FamilyChange> = {};
  const repMonthlySeries: Record<string, MonthPoint[]> = {};
  for (const [rep, months] of repTotals) {
    const curr = months.get(latest);
    const prevTotal = months.get(prev);
    const change = changeFor(prevTotal?.value, curr?.value);
    if (change) repChanges[rep] = change;
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
  // Uploading targets for the wrong month is an easy mistake — an October
  // targets file next to sales that only run to September — and it used to
  // fail completely silently: hasTargets stayed false and the section just
  // wasn't there. Record the mismatch so the dashboard can say so.
  const targetMonths = Array.from(new Set(targets.map((t) => t.month))).sort((a, b) => a - b);
  const hasTargets = targetMonths.includes(latest);
  const targetMonthMismatch =
    targetMonths.length > 0 && !hasTargets ? { targetMonths, latestMonth: latest } : null;
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
    hasLines,
    isSystemicDrop: anySystemicDrop,
    areas: areaChanges,
    lines,
    familyChanges,
    areaFamilyChanges,
    itemMonthlySeries,
    findings,
    hasQuantity,
    hasReps,
    repChanges,
    repMonthlySeries,
    repAverageSeries,
    hasTargets,
    areaTargets,
    repTargets,
    targetMonthMismatch,
  };
}
