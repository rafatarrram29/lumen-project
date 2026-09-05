// Safety net for the 5 decision rules in src/lib/lumen/engine.ts.
//
// Everything else in the app — the dashboard, the exports, the IMS panel —
// renders whatever this function returns, so a silent change in here is a
// silent change in every number the user reads. These tests pin the rules
// down before any refactoring touches them.
//
// Run with:  npm test

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildReport, DEFAULT_LINE } from "../src/lib/lumen/engine.ts";
import type { Finding } from "../src/lib/lumen/engine.ts";
import { rec, target, areaSeries, ok, shuffle } from "./helpers.ts";

const YEAR = 2025;

function findingsOfType<T extends Finding["type"]>(findings: Finding[], type: T) {
  return findings.filter((f) => f.type === type) as Extract<Finding, { type: T }>[];
}

describe("guards", () => {
  test("no records at all is an error, naming the year asked for", () => {
    const report = buildReport([], 2024);
    assert.deepEqual(report, { error: "No data found for year 2024." });
  });

  test("a single month cannot be compared to anything", () => {
    const report = buildReport(areaSeries({ Alpha: [1000] }), YEAR);
    assert.deepEqual(report, { error: "Need at least 2 months of data to compare." });
  });

  test("two months is enough", () => {
    const report = ok(buildReport(areaSeries({ Alpha: [1000, 900] }), YEAR));
    assert.equal(report.latestMonth, 2);
    assert.equal(report.comparedToMonth, 1);
  });

  test("the two months compared are the last two PRESENT, not the last two on the calendar", () => {
    // A dataset with a gap (no month 3, no month 4) must compare 5 to 2,
    // not 5 to 4 — otherwise a missing month reads as a total collapse.
    const records = [
      rec({ area: "Alpha", family: "ItemA", month: 1, salesValue: 900 }),
      rec({ area: "Alpha", family: "ItemA", month: 2, salesValue: 1000 }),
      rec({ area: "Alpha", family: "ItemA", month: 5, salesValue: 800 }),
    ];
    const report = ok(buildReport(records, YEAR));
    assert.equal(report.latestMonth, 5);
    assert.equal(report.comparedToMonth, 2);
    assert.equal(report.areas.Alpha.pctChange, -20);
  });
});

describe("rule 1 — trend over the last 3 months, not one month", () => {
  test("three straight declines is a streak", () => {
    const report = ok(buildReport(areaSeries({ Alpha: [1200, 900, 800, 700] }), YEAR));
    const alpha = report.areas.Alpha;
    assert.equal(alpha.decliningStreak, true);
    assert.equal(alpha.monthsInStreak, 3);
  });

  test("a dip followed by a rise is not a streak, even though the last month fell", () => {
    // Months 2,3,4 = 800, 900, 700. The final month is down, but the run is
    // not monotonic, and rule 1 exists precisely to not call that a trend.
    const report = ok(buildReport(areaSeries({ Alpha: [1000, 800, 900, 700] }), YEAR));
    assert.equal(report.areas.Alpha.decliningStreak, false);
  });

  test("a flat month breaks the streak — declines must be strict", () => {
    const report = ok(buildReport(areaSeries({ Alpha: [1000, 900, 900, 800] }), YEAR));
    assert.equal(report.areas.Alpha.decliningStreak, false);
  });

  test("rising every month is never a streak", () => {
    const report = ok(buildReport(areaSeries({ Alpha: [700, 800, 900, 1000] }), YEAR));
    assert.equal(report.areas.Alpha.decliningStreak, false);
  });

  test("the chart series is capped at the last 6 months and stays in month order", () => {
    const eight = [10, 20, 30, 40, 50, 60, 70, 80];
    const report = ok(buildReport(areaSeries({ Alpha: eight }), YEAR));
    const series = report.areas.Alpha.monthlySeries;
    assert.equal(series.length, 6);
    assert.deepEqual(
      series.map((p) => p.month),
      [3, 4, 5, 6, 7, 8],
    );
    assert.deepEqual(
      series.map((p) => p.value),
      [30, 40, 50, 60, 70, 80],
    );
  });

  test("quantities are summed alongside values", () => {
    const records = [
      rec({ area: "Alpha", family: "ItemA", month: 1, salesValue: 100, salesQty: 5 }),
      rec({ area: "Alpha", family: "ItemB", month: 1, salesValue: 200, salesQty: 7 }),
      rec({ area: "Alpha", family: "ItemA", month: 2, salesValue: 150, salesQty: 9 }),
    ];
    const report = ok(buildReport(records, YEAR));
    assert.equal(report.areas.Alpha.prevQty, 12);
    assert.equal(report.areas.Alpha.currQty, 9);
  });

  test("a missing quantity counts as zero rather than poisoning the sum", () => {
    const records = [
      rec({ area: "Alpha", family: "ItemA", month: 1, salesValue: 100, salesQty: null }),
      rec({ area: "Alpha", family: "ItemB", month: 1, salesValue: 100, salesQty: 4 }),
      rec({ area: "Alpha", family: "ItemA", month: 2, salesValue: 100, salesQty: 3 }),
    ];
    const report = ok(buildReport(records, YEAR));
    assert.equal(report.areas.Alpha.prevQty, 4);
    assert.equal(report.areas.Alpha.currQty, 3);
  });
});

describe("percentage change", () => {
  test("is rounded to one decimal place", () => {
    const report = ok(buildReport(areaSeries({ Alpha: [3000, 2777] }), YEAR));
    assert.equal(report.areas.Alpha.pctChange, -7.4);
  });

  test("is null when the previous month was zero — no percentage exists from nothing", () => {
    const report = ok(buildReport(areaSeries({ Alpha: [0, 500] }), YEAR));
    assert.equal(report.areas.Alpha.pctChange, null);
    assert.equal(report.areas.Alpha.currValue, 500);
  });

  test("is -100 when this month is zero", () => {
    const report = ok(buildReport(areaSeries({ Alpha: [500, 0] }), YEAR));
    assert.equal(report.areas.Alpha.pctChange, -100);
  });
});

describe("rule 2 — systemic check before blaming one area", () => {
  const systemic = { A: [1000, 800], B: [1000, 800], C: [1000, 800], D: [1000, 1000] };

  test("most of the line dropping together is called line-wide, not four failures", () => {
    const report = ok(buildReport(areaSeries(systemic), YEAR));
    assert.equal(report.isSystemicDrop, true);
    const found = findingsOfType(report.findings, "systemic_drop");
    assert.equal(found.length, 1);
    assert.equal(found[0].droppingCount, 3);
    assert.equal(found[0].totalAreas, 4);
    // and no area is singled out
    assert.equal(findingsOfType(report.findings, "local_drop").length, 0);
  });

  test("a minority dropping is reported per area instead", () => {
    const report = ok(
      buildReport(areaSeries({ A: [1000, 800], B: [1000, 800], C: [1000, 1000], D: [1000, 1000] }), YEAR),
    );
    assert.equal(report.isSystemicDrop, false);
    const local = findingsOfType(report.findings, "local_drop");
    assert.deepEqual(local.map((f) => f.area).sort(), ["A", "B"]);
  });

  test("exactly 60% of areas dropping is systemic (the threshold is inclusive)", () => {
    const report = ok(
      buildReport(
        areaSeries({ A: [1000, 800], B: [1000, 800], C: [1000, 800], D: [1000, 1000], E: [1000, 1000] }),
        YEAR,
      ),
    );
    assert.equal(report.isSystemicDrop, true);
  });

  test("a drop of exactly -15% counts as dropping", () => {
    const report = ok(buildReport(areaSeries({ A: [1000, 850], B: [1000, 850] }), YEAR));
    assert.equal(report.areas.A.pctChange, -15);
    assert.equal(report.isSystemicDrop, true);
  });

  test("a drop of -14.9% does not", () => {
    const report = ok(buildReport(areaSeries({ A: [1000, 851], B: [1000, 851] }), YEAR));
    assert.equal(report.areas.A.pctChange, -14.9);
    assert.equal(report.isSystemicDrop, false);
    assert.equal(report.findings.length, 0);
  });

  test("with no line column every area shares one default line", () => {
    const report = ok(buildReport(areaSeries(systemic), YEAR));
    assert.equal(report.hasLines, false);
    assert.deepEqual(Object.keys(report.lines), [DEFAULT_LINE]);
    assert.equal(report.lines[DEFAULT_LINE].totalAreas, 4);
    // the default line's name is not repeated back at the reader
    assert.ok(!findingsOfType(report.findings, "systemic_drop")[0].summary.includes(DEFAULT_LINE));
  });

  test("the check runs inside each line separately, so one line collapsing does not implicate the other", () => {
    const records = areaSeries(
      { A: [1000, 700], B: [1000, 700], C: [1000, 1000], D: [1000, 1000] },
      { line: (area) => (area === "A" || area === "B" ? "Line 1" : "Line 2") },
    );
    const report = ok(buildReport(records, YEAR));
    assert.equal(report.hasLines, true);
    assert.equal(report.lines["Line 1"].isSystemicDrop, true);
    assert.equal(report.lines["Line 2"].isSystemicDrop, false);
    assert.equal(report.isSystemicDrop, true);

    const systemicFindings = findingsOfType(report.findings, "systemic_drop");
    assert.equal(systemicFindings.length, 1);
    assert.equal(systemicFindings[0].line, "Line 1");
    assert.ok(systemicFindings[0].summary.includes("Line 1"));
  });

  test("the same two areas dropping read as systemic in their own line but local in a shared one", () => {
    // The exact scenario rule 2's line scoping exists for: identical
    // numbers, different verdict depending on what they are compared with.
    const numbers = { A: [1000, 700], B: [1000, 700], C: [1000, 1000], D: [1000, 1000] };
    const pooled = ok(buildReport(areaSeries(numbers), YEAR));
    const split = ok(
      buildReport(
        areaSeries(numbers, { line: (a) => (a === "A" || a === "B" ? "Line 1" : "Line 2") }),
        YEAR,
      ),
    );
    assert.equal(findingsOfType(pooled.findings, "local_drop").length, 2);
    assert.equal(findingsOfType(pooled.findings, "systemic_drop").length, 0);
    assert.equal(findingsOfType(split.findings, "local_drop").length, 0);
    assert.equal(findingsOfType(split.findings, "systemic_drop").length, 1);
  });

  test("a line's chart series averages its areas month by month", () => {
    const records = areaSeries({ A: [100, 200], B: [300, 400] });
    const report = ok(buildReport(records, YEAR));
    assert.deepEqual(report.lines[DEFAULT_LINE].monthlySeries, [
      { month: 1, avgValue: 200 },
      { month: 2, avgValue: 300 },
    ]);
  });
});

describe("rule 3 — root cause by item", () => {
  test("the systemic finding blames the item with the largest absolute drop across the line", () => {
    const records = [
      // Big is the bigger money loss; Sharp falls by a bigger percentage.
      ...[1, 2].flatMap((m) => [
        rec({ area: "A", family: "Big", month: m, salesValue: m === 1 ? 5000 : 3000 }),
        rec({ area: "A", family: "Sharp", month: m, salesValue: m === 1 ? 500 : 50 }),
        rec({ area: "B", family: "Big", month: m, salesValue: m === 1 ? 5000 : 3000 }),
        rec({ area: "B", family: "Sharp", month: m, salesValue: m === 1 ? 500 : 50 }),
      ]),
    ];
    const report = ok(buildReport(records, YEAR));
    const finding = findingsOfType(report.findings, "systemic_drop")[0];
    assert.equal(finding.rootCauseFamily, "Big");
    assert.equal(finding.rootCauseDetail.absDrop, 4000);
    // the full breakdown travels with the finding, not just the winner
    assert.deepEqual(Object.keys(finding.allFamilies).sort(), ["Big", "Sharp"]);
    assert.equal(finding.allFamilies.Sharp.absDrop, 900);
  });

  test("a local finding blames the worst item in that area alone", () => {
    const records = [
      ...[1, 2].flatMap((m) => [
        rec({ area: "A", family: "Falling", month: m, salesValue: m === 1 ? 800 : 200 }),
        rec({ area: "A", family: "Steady", month: m, salesValue: m === 1 ? 200 : 200 }),
        rec({ area: "B", family: "Falling", month: m, salesValue: 1000 }),
        rec({ area: "B", family: "Steady", month: m, salesValue: 1000 }),
      ]),
    ];
    const report = ok(buildReport(records, YEAR));
    const local = findingsOfType(report.findings, "local_drop");
    assert.equal(local.length, 1);
    assert.equal(local[0].area, "A");
    assert.equal(local[0].rootCauseFamily, "Falling");
    assert.equal(local[0].rootCauseDetail.absDrop, 600);
  });

  test("the per-area item breakdown is built for every area, not only the dropping ones", () => {
    const report = ok(buildReport(areaSeries({ A: [1000, 800], B: [1000, 1200] }), YEAR));
    assert.deepEqual(Object.keys(report.areaFamilyChanges).sort(), ["A", "B"]);
  });

  test("the line-wide item totals add up across areas", () => {
    const records = [
      ...[1, 2].flatMap((m) => [
        rec({ area: "A", family: "ItemA", month: m, salesValue: m === 1 ? 1000 : 500 }),
        rec({ area: "B", family: "ItemA", month: m, salesValue: m === 1 ? 1000 : 500 }),
      ]),
    ];
    const report = ok(buildReport(records, YEAR));
    assert.deepEqual(report.familyChanges.ItemA, {
      prevValue: 2000,
      currValue: 1000,
      pctChange: -50,
      absDrop: 1000,
    });
  });
});

describe("rule 4 — transfer opportunity", () => {
  const rising = [
    ...[1, 2].flatMap((m) => [
      rec({ area: "Star", family: "Grower", month: m, salesValue: m === 1 ? 400 : 560 }),
      rec({ area: "Star", family: "Flat", month: m, salesValue: m === 1 ? 600 : 620 }),
    ]),
  ];

  test("an item growing well inside a growing area is flagged to replicate", () => {
    const report = ok(buildReport(rising, YEAR));
    const transfers = findingsOfType(report.findings, "transfer_opportunity");
    assert.equal(transfers.length, 1);
    assert.equal(transfers[0].area, "Star");
    assert.equal(transfers[0].family, "Grower");
    assert.equal(transfers[0].pctChange, 40);
  });

  test("an area that merely held steady produces nothing to transfer", () => {
    const flat = [
      ...[1, 2].flatMap((m) => [
        rec({ area: "Steady", family: "Grower", month: m, salesValue: m === 1 ? 400 : 560 }),
        rec({ area: "Steady", family: "Flat", month: m, salesValue: m === 1 ? 600 : 440 }),
      ]),
    ];
    const report = ok(buildReport(flat, YEAR));
    assert.equal(report.areas.Steady.pctChange, 0);
    assert.equal(findingsOfType(report.findings, "transfer_opportunity").length, 0);
  });

  test("an item growing exactly 10% is below the bar", () => {
    const records = [
      ...[1, 2].flatMap((m) => [
        rec({ area: "Star", family: "Ten", month: m, salesValue: m === 1 ? 500 : 550 }),
        rec({ area: "Star", family: "Engine", month: m, salesValue: m === 1 ? 500 : 700 }),
      ]),
    ];
    const report = ok(buildReport(records, YEAR));
    const transfers = findingsOfType(report.findings, "transfer_opportunity");
    assert.deepEqual(transfers.map((f) => f.family), ["Engine"]);
  });

  test("an item that only exists this month is not a transfer candidate — there is nothing to compare", () => {
    const records = [
      rec({ area: "Star", family: "Base", month: 1, salesValue: 1000 }),
      rec({ area: "Star", family: "Base", month: 2, salesValue: 1300 }),
      rec({ area: "Star", family: "BrandNew", month: 2, salesValue: 900 }),
    ];
    const report = ok(buildReport(records, YEAR));
    const transfers = findingsOfType(report.findings, "transfer_opportunity");
    assert.deepEqual(transfers.map((f) => f.family), ["Base"]);
  });
});

describe("rule 5 — every finding ends in an action", () => {
  test("no finding is left as a bare observation", () => {
    // One dataset that triggers all three finding types at once.
    const records = [
      ...areaSeries({ A: [1000, 700], B: [1000, 700], C: [1000, 1000] }, { line: () => "Line 1" }),
      ...[1, 2].flatMap((m) => [
        rec({ area: "Solo", family: "Falling", month: m, salesValue: m === 1 ? 1000 : 400, line: "Line 2" }),
        rec({ area: "Solo", family: "Steady", month: m, salesValue: 500, line: "Line 2" }),
        rec({ area: "Peer", family: "Falling", month: m, salesValue: 1000, line: "Line 2" }),
        rec({ area: "Peer", family: "Steady", month: m, salesValue: 500, line: "Line 2" }),
        rec({ area: "Star", family: "Grower", month: m, salesValue: m === 1 ? 400 : 560, line: "Line 3" }),
        rec({ area: "Star", family: "Flat", month: m, salesValue: m === 1 ? 600 : 620, line: "Line 3" }),
      ]),
    ];
    const report = ok(buildReport(records, YEAR));
    const types = new Set(report.findings.map((f) => f.type));
    assert.deepEqual([...types].sort(), ["local_drop", "systemic_drop", "transfer_opportunity"]);

    for (const f of report.findings) {
      assert.ok(f.summary.trim().length > 0, `empty summary on ${f.type}`);
      assert.ok(f.decision.trim().length > 0, `empty decision on ${f.type}`);
      assert.notEqual(f.summary, f.decision);
    }
  });
});

describe("items that start or stop selling stay visible", () => {
  // Regression: both months used to be required, so a genuinely new or
  // discontinued item silently vanished from every breakdown — which is
  // what made "items analyzed" read lower than the file's real item count.
  const records = [
    rec({ area: "A", family: "Discontinued", month: 1, salesValue: 500 }),
    rec({ area: "A", family: "BrandNew", month: 2, salesValue: 500 }),
    rec({ area: "A", family: "Steady", month: 1, salesValue: 1000 }),
    rec({ area: "A", family: "Steady", month: 2, salesValue: 1000 }),
  ];

  test("a discontinued item keeps its real numbers", () => {
    const report = ok(buildReport(records, YEAR));
    assert.deepEqual(report.areaFamilyChanges.A.Discontinued, {
      prevValue: 500,
      currValue: 0,
      pctChange: -100,
      absDrop: 500,
    });
  });

  test("a brand-new item shows its value with no misleading percentage", () => {
    const report = ok(buildReport(records, YEAR));
    assert.deepEqual(report.areaFamilyChanges.A.BrandNew, {
      prevValue: 0,
      currValue: 500,
      pctChange: null,
      absDrop: -500,
    });
  });

  test("all three items survive into the line-wide totals", () => {
    const report = ok(buildReport(records, YEAR));
    assert.deepEqual(Object.keys(report.familyChanges).sort(), ["BrandNew", "Discontinued", "Steady"]);
  });

  test("an item's own trend line covers every month it sold in", () => {
    const report = ok(buildReport(records, YEAR));
    assert.deepEqual(report.itemMonthlySeries.Discontinued, [{ month: 1, value: 500, qty: 0 }]);
    assert.deepEqual(report.itemMonthlySeries.BrandNew, [{ month: 2, value: 500, qty: 0 }]);
    assert.equal(report.itemMonthlySeries.Steady.length, 2);
  });
});

describe("reps", () => {
  test("a dataset with no rep column reports no rep data at all", () => {
    const report = ok(buildReport(areaSeries({ A: [1000, 900] }), YEAR));
    assert.equal(report.hasReps, false);
    assert.deepEqual(report.repChanges, {});
    assert.deepEqual(report.repMonthlySeries, {});
  });

  test("each rep's change is measured across every area they cover", () => {
    const records = [
      ...[1, 2].flatMap((m) => [
        rec({ area: "A", family: "X", month: m, salesValue: m === 1 ? 600 : 300, rep: "Sara" }),
        rec({ area: "B", family: "X", month: m, salesValue: m === 1 ? 400 : 300, rep: "Sara" }),
        rec({ area: "C", family: "X", month: m, salesValue: m === 1 ? 500 : 1000, rep: "Omar" }),
      ]),
    ];
    const report = ok(buildReport(records, YEAR));
    assert.equal(report.hasReps, true);
    assert.deepEqual(report.repChanges.Sara, { prevValue: 1000, currValue: 600, pctChange: -40, absDrop: 400 });
    assert.deepEqual(report.repChanges.Omar, { prevValue: 500, currValue: 1000, pctChange: 100, absDrop: -500 });
  });

  test("rows with no rep are left out of the rep view but still count for the area", () => {
    const records = [
      ...[1, 2].flatMap((m) => [
        rec({ area: "A", family: "X", month: m, salesValue: 500, rep: "Sara" }),
        rec({ area: "A", family: "Y", month: m, salesValue: 500, rep: null }),
      ]),
    ];
    const report = ok(buildReport(records, YEAR));
    assert.deepEqual(Object.keys(report.repChanges), ["Sara"]);
    assert.equal(report.repChanges.Sara.currValue, 500);
    assert.equal(report.areas.A.currValue, 1000);
  });

  test("the peer-average series only averages reps who actually sold that month", () => {
    const records = [
      rec({ area: "A", family: "X", month: 1, salesValue: 1000, rep: "Sara" }),
      rec({ area: "A", family: "X", month: 2, salesValue: 400, rep: "Sara" }),
      // Omar joins in month 2 only
      rec({ area: "B", family: "X", month: 2, salesValue: 600, rep: "Omar" }),
    ];
    const report = ok(buildReport(records, YEAR));
    assert.deepEqual(report.repAverageSeries, [
      { month: 1, avgValue: 1000 },
      { month: 2, avgValue: 500 },
    ]);
  });
});

describe("targets vs actual", () => {
  const sales = areaSeries({ A: [1000, 900] }, { rep: () => "Sara" });

  test("no targets means the section stays off", () => {
    const report = ok(buildReport(sales, YEAR));
    assert.equal(report.hasTargets, false);
    assert.deepEqual(report.areaTargets, {});
    assert.deepEqual(report.repTargets, {});
  });

  test("only the latest month's targets are compared", () => {
    const report = ok(buildReport(sales, YEAR, [target({ month: 1, area: "A", targetValue: 5000 })]));
    assert.equal(report.hasTargets, false);
    assert.deepEqual(report.areaTargets, {});
  });

  test("achievement is the latest month's actual over its target, to one decimal", () => {
    const report = ok(buildReport(sales, YEAR, [target({ month: 2, area: "A", targetValue: 1200 })]));
    assert.equal(report.hasTargets, true);
    assert.deepEqual(report.areaTargets.A, { targetValue: 1200, pctOfTarget: 75 });
  });

  test("achievement keeps one decimal rather than rounding to a whole percent", () => {
    const report = ok(buildReport(sales, YEAR, [target({ month: 2, area: "A", targetValue: 1300 })]));
    assert.equal(report.areaTargets.A.pctOfTarget, 69.2);
  });

  test("several target rows for the same area add up", () => {
    const report = ok(
      buildReport(sales, YEAR, [
        target({ month: 2, area: "A", targetValue: 500 }),
        target({ month: 2, area: "A", targetValue: 400 }),
      ]),
    );
    assert.deepEqual(report.areaTargets.A, { targetValue: 900, pctOfTarget: 100 });
  });

  test("one row naming both an area and a rep counts toward both", () => {
    const report = ok(buildReport(sales, YEAR, [target({ month: 2, area: "A", rep: "Sara", targetValue: 900 })]));
    assert.equal(report.areaTargets.A.pctOfTarget, 100);
    assert.equal(report.repTargets.Sara.pctOfTarget, 100);
  });

  test("a zero target gives no percentage rather than infinity", () => {
    const report = ok(buildReport(sales, YEAR, [target({ month: 2, area: "A", targetValue: 0 })]));
    assert.deepEqual(report.areaTargets.A, { targetValue: 0, pctOfTarget: null });
  });

  test("a target for an area with no sales at all still shows, with no percentage", () => {
    const report = ok(buildReport(sales, YEAR, [target({ month: 2, area: "Ghost", targetValue: 1000 })]));
    assert.deepEqual(report.areaTargets.Ghost, { targetValue: 1000, pctOfTarget: null });
  });
});

describe("the same rows in a different order give the same answer", () => {
  // Rows come back from Postgres in pages fetched in parallel, so their
  // order is arbitrary. Nothing the engine reports may depend on it.
  //
  // This dataset is deliberately built to make order MATTER if the engine
  // lets it: three lines that each take a different branch, several
  // findings of every type so the array has an order to get wrong, and a
  // deliberate tie for "worst item" that has to break the same way twice.
  const twoMonths = <T,>(f: (m: number) => T[]) => [1, 2].flatMap(f);

  const records = [
    // Line Alpha — every area collapses, so the whole line reads systemic.
    ...twoMonths((m) => [
      rec({ area: "A1", family: "Pill", month: m, salesValue: m === 1 ? 600 : 400, line: "Alpha", rep: "Nour" }),
      rec({ area: "A1", family: "Syrup", month: m, salesValue: m === 1 ? 400 : 300, line: "Alpha", rep: "Nour" }),
      rec({ area: "A2", family: "Pill", month: m, salesValue: m === 1 ? 800 : 500, line: "Alpha", rep: "Nour" }),
      rec({ area: "A2", family: "Syrup", month: m, salesValue: m === 1 ? 200 : 150, line: "Alpha", rep: "Nour" }),
      rec({ area: "A3", family: "Pill", month: m, salesValue: m === 1 ? 500 : 350, line: "Alpha", rep: "Hala" }),
      // A3's Syrup is sized so that line-wide, Pill and Syrup lose exactly
      // the same 650 — a tie in the systemic branch as well as the local one.
      rec({ area: "A3", family: "Syrup", month: m, salesValue: m === 1 ? 800 : 300, line: "Alpha", rep: "Hala" }),
    ]),
    // Line Beta — only 2 of 5 areas drop, so they are reported one by one.
    // B1's two items lose the exact same amount: a tie to break.
    ...twoMonths((m) => [
      rec({ area: "B1", family: "Xray", month: m, salesValue: m === 1 ? 500 : 200, line: "Beta", rep: "Hala" }),
      rec({ area: "B1", family: "Alkane", month: m, salesValue: m === 1 ? 500 : 200, line: "Beta", rep: "Hala" }),
      rec({ area: "B2", family: "Delta", month: m, salesValue: m === 1 ? 700 : 400, line: "Beta", rep: "Omar" }),
      rec({ area: "B2", family: "Echo", month: m, salesValue: 300, line: "Beta", rep: "Omar" }),
      rec({ area: "B3", family: "Delta", month: m, salesValue: 1000, line: "Beta", rep: "Omar" }),
      rec({ area: "B4", family: "Delta", month: m, salesValue: 1000, line: "Beta", rep: "Sara" }),
      rec({ area: "B5", family: "Echo", month: m, salesValue: 1000, line: "Beta", rep: "Sara" }),
    ]),
    // Line Gamma — three growing areas, each with two items worth copying.
    ...twoMonths((m) => [
      rec({ area: "G1", family: "Grow", month: m, salesValue: m === 1 ? 500 : 700, line: "Gamma", rep: "Sara" }),
      rec({ area: "G1", family: "Climb", month: m, salesValue: m === 1 ? 500 : 600, line: "Gamma", rep: "Sara" }),
      rec({ area: "G2", family: "Grow", month: m, salesValue: m === 1 ? 400 : 600, line: "Gamma", rep: "Nour" }),
      rec({ area: "G2", family: "Climb", month: m, salesValue: m === 1 ? 600 : 750, line: "Gamma", rep: "Nour" }),
      rec({ area: "G3", family: "Grow", month: m, salesValue: m === 1 ? 300 : 500, line: "Gamma", rep: "Omar" }),
      rec({ area: "G3", family: "Climb", month: m, salesValue: m === 1 ? 700 : 900, line: "Gamma", rep: "Omar" }),
    ]),
  ];
  const targets = [
    target({ month: 2, area: "A1", targetValue: 1500 }),
    target({ month: 2, rep: "Sara", targetValue: 2200 }),
    target({ month: 2, area: "G2", rep: "Nour", targetValue: 1000 }),
  ];

  test("the dataset really does exercise all three rules at once", () => {
    // Guards the tests below: if this dataset ever stops producing a rich,
    // multi-finding report, shuffling it proves nothing.
    const report = ok(buildReport(records, YEAR, targets));
    assert.ok(report.findings.length >= 8, `only ${report.findings.length} findings`);
    assert.equal(findingsOfType(report.findings, "systemic_drop").length, 1);
    assert.equal(findingsOfType(report.findings, "local_drop").length, 2);
    assert.equal(findingsOfType(report.findings, "transfer_opportunity").length, 6);
    assert.deepEqual(Object.keys(report.lines).sort(), ["Alpha", "Beta", "Gamma"]);
  });

  for (const seed of [1, 7, 99, 12345, 424242, 777]) {
    test(`shuffled with seed ${seed}`, () => {
      const base = ok(buildReport(records, YEAR, targets));
      const shuffled = ok(buildReport(shuffle(records, seed), YEAR, shuffle(targets, seed)));
      // Compared whole, findings array included and IN ORDER — not sorted
      // first. A report that reorders itself between two runs of the same
      // data cannot be diffed, cached, or trusted.
      assert.deepEqual(shuffled, base);
    });
  }

  test("a tie for worst item breaks the same way every time", () => {
    // Two ties on purpose: B1 loses exactly 300 on each of its two items
    // (the local branch), and line Alpha loses exactly 650 on each of its
    // two items (the systemic branch). Whichever row was read first used to
    // win in both.
    const local = new Set<string>();
    const systemic = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const report = ok(buildReport(shuffle(records, seed), YEAR));
      local.add(
        findingsOfType(report.findings, "local_drop").find((f) => f.area === "B1")!.rootCauseFamily,
      );
      const alpha = findingsOfType(report.findings, "systemic_drop").find((f) => f.line === "Alpha")!;
      assert.equal(alpha.allFamilies.Pill.absDrop, alpha.allFamilies.Syrup.absDrop, "the tie was lost");
      systemic.add(alpha.rootCauseFamily);
    }
    assert.deepEqual([...local], ["Alkane"]);
    assert.deepEqual([...systemic], ["Pill"]);
  });

  test("an area whose rows disagree about their line takes the majority label, not the first row", () => {
    // A mis-keyed file: three rows say "Zebra line", one says "Apex line".
    // The majority is deliberately the alphabetically LATER label, so a
    // tie-break that ignored the vote count would pick the wrong one.
    const conflicted = [
      rec({ area: "A", family: "X", month: 1, salesValue: 100, line: "Apex line" }),
      rec({ area: "A", family: "Y", month: 1, salesValue: 100, line: "Zebra line" }),
      rec({ area: "A", family: "Z", month: 1, salesValue: 100, line: "Zebra line" }),
      rec({ area: "A", family: "W", month: 2, salesValue: 100, line: "Zebra line" }),
    ];
    for (const seed of [1, 2, 3, 4, 5]) {
      const report = ok(buildReport(shuffle(conflicted, seed), YEAR));
      assert.equal(report.areas.A.line, "Zebra line");
    }
  });

  test("a blank line on some rows never outvotes a real label", () => {
    const mixed = [
      rec({ area: "A", family: "X", month: 1, salesValue: 100, line: null }),
      rec({ area: "A", family: "Y", month: 1, salesValue: 100, line: null }),
      rec({ area: "A", family: "Z", month: 1, salesValue: 100, line: "  " }),
      rec({ area: "A", family: "W", month: 2, salesValue: 100, line: "Line 1" }),
    ];
    for (const seed of [1, 2, 3]) {
      const report = ok(buildReport(shuffle(mixed, seed), YEAR));
      assert.equal(report.areas.A.line, "Line 1");
    }
  });

  test("an area with no line at all still lands in the default line", () => {
    const report = ok(buildReport(areaSeries({ A: [100, 200] }), YEAR));
    assert.equal(report.areas.A.line, DEFAULT_LINE);
  });
});
