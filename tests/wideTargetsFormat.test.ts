// Some Targets exports lay every month out side by side instead of one row
// per month: a two-row header (a month/"Year Total" label above each block
// of columns, a repeating metric-name row below it). These pin the
// detector that recognizes that shape and unpivots it into ordinary
// long-format rows, plus the small label-classifying helpers it's built on.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseMonthGroupLabel,
  isTotalsGroupLabel,
  isTotalsRowLabel,
  detectWideTargetsLayout,
} from "../src/lib/lumen/wideTargetsFormat.ts";

describe("parseMonthGroupLabel", () => {
  test("bare month numbers 1-12", () => {
    for (let m = 1; m <= 12; m++) assert.equal(parseMonthGroupLabel(m), m);
    for (let m = 1; m <= 12; m++) assert.equal(parseMonthGroupLabel(String(m)), m);
  });

  test("month names, short and long, case-insensitive", () => {
    assert.equal(parseMonthGroupLabel("Jan"), 1);
    assert.equal(parseMonthGroupLabel("january"), 1);
    assert.equal(parseMonthGroupLabel("JUNE"), 6);
    assert.equal(parseMonthGroupLabel("Dec"), 12);
    assert.equal(parseMonthGroupLabel("sept"), 9);
  });

  test("out-of-range or non-integer numbers are not months", () => {
    assert.equal(parseMonthGroupLabel(0), null);
    assert.equal(parseMonthGroupLabel(13), null);
    assert.equal(parseMonthGroupLabel(-1), null);
    assert.equal(parseMonthGroupLabel(6.5), null);
    assert.equal(parseMonthGroupLabel("6.5"), null);
  });

  test("junk, blanks, and totals are not months", () => {
    assert.equal(parseMonthGroupLabel("Item"), null);
    assert.equal(parseMonthGroupLabel("2026 Total"), null);
    assert.equal(parseMonthGroupLabel(""), null);
    assert.equal(parseMonthGroupLabel(null), null);
    assert.equal(parseMonthGroupLabel(undefined), null);
  });

  test("Arabic-Indic digits are read the same as a real Targets file would type them", () => {
    assert.equal(parseMonthGroupLabel("٦"), 6);
  });
});

describe("isTotalsGroupLabel", () => {
  test("a year- or word-qualified total is a total", () => {
    assert.equal(isTotalsGroupLabel("2026 Total"), true);
    assert.equal(isTotalsGroupLabel("Year Total"), true);
    assert.equal(isTotalsGroupLabel("TOTAL"), true);
    assert.equal(isTotalsGroupLabel("Total"), true);
  });

  test("a month is not a total", () => {
    assert.equal(isTotalsGroupLabel("6"), false);
    assert.equal(isTotalsGroupLabel("June"), false);
  });

  test("blank is not a total", () => {
    assert.equal(isTotalsGroupLabel(null), false);
    assert.equal(isTotalsGroupLabel(""), false);
  });
});

describe("isTotalsRowLabel", () => {
  test("Grand Total, any case, matches", () => {
    assert.equal(isTotalsRowLabel("Grand Total"), true);
    assert.equal(isTotalsRowLabel("GRAND TOTAL"), true);
    assert.equal(isTotalsRowLabel("  grand total  "), true);
    assert.equal(isTotalsRowLabel("Total"), true);
  });

  test("a real item name is never mistaken for a totals row, even one containing the word", () => {
    assert.equal(isTotalsRowLabel("Total Care Vitamins"), false);
    assert.equal(isTotalsRowLabel("Grand Total Tablets"), false);
  });

  test("blank does not match", () => {
    assert.equal(isTotalsRowLabel(null), false);
    assert.equal(isTotalsRowLabel(""), false);
  });
});

const METRICS = ["Sales Qty", "FCT Qty", "Sales Val", "FCT Val", "Ach %"];

/**
 * Builds a wide-format raw+display grid: passthrough columns (e.g. Item,
 * Team), then one 5-column block per month in `months`, then (optionally) a
 * trailing "<year> Total" block. `monthCellStyle` controls whether the
 * group-row month label is repeated on every column of its block ("repeat",
 * as a person might type it) or left as a single anchor cell with the rest
 * blank ("merge", as a real merged Excel cell reads back).
 */
function buildWideGrid(opts: {
  months: number[];
  items: string[];
  includeTotal?: boolean;
  monthCellStyle?: "merge" | "repeat";
  strayRowsAbove?: boolean;
  swapMetricOrderForMonth?: number;
}) {
  const { months, items, includeTotal = true, monthCellStyle = "merge", strayRowsAbove = false, swapMetricOrderForMonth } = opts;
  const passthrough = ["Item", "Team"];

  const groupRow: unknown[] = [];
  const metricRow: unknown[] = [];
  for (const h of passthrough) {
    groupRow.push(null);
    metricRow.push(h);
  }

  const monthColStart = new Map<number, number>();
  for (const m of months) {
    monthColStart.set(m, groupRow.length);
    const names = m === swapMetricOrderForMonth ? [...METRICS].reverse() : METRICS;
    names.forEach((name, i) => {
      groupRow.push(monthCellStyle === "repeat" || i === 0 ? m : null);
      metricRow.push(name);
    });
  }

  let totalColStart: number | null = null;
  if (includeTotal) {
    totalColStart = groupRow.length;
    METRICS.forEach((name, i) => {
      groupRow.push(monthCellStyle === "repeat" || i === 0 ? "2026 Total" : null);
      metricRow.push(name);
    });
  }

  const rawGrid: unknown[][] = [];
  const displayGrid: unknown[][] = [];

  if (strayRowsAbove) {
    const stray1 = new Array(groupRow.length).fill(null);
    stray1[2] = "Year";
    stray1[3] = "Month";
    const stray2 = new Array(groupRow.length).fill(null);
    stray2[2] = "2026";
    rawGrid.push(stray1, stray2);
    displayGrid.push(stray1, stray2);
  }

  rawGrid.push(groupRow, metricRow);
  displayGrid.push(groupRow, metricRow);

  // A distinctive, easy-to-spot value per (item, month, metric) so a test
  // can tell "month 3's Sales Val" apart from "month 7's Sales Val" and
  // catch any mix-up between columns.
  const value = (itemIndex: number, month: number, metricIndex: number) => itemIndex * 100000 + month * 1000 + metricIndex;

  items.forEach((item, itemIndex) => {
    const row: unknown[] = [item, "Team L"];
    for (const m of months) {
      for (let i = 0; i < METRICS.length; i++) row.push(value(itemIndex, m, i));
    }
    if (includeTotal) {
      // Sentinel values that must never leak into unpivoted output.
      for (let i = 0; i < METRICS.length; i++) row.push(90000 + i);
    }
    rawGrid.push(row);
    displayGrid.push(row);
  });

  return { rawGrid, displayGrid, value, monthColStart, totalColStart };
}

describe("detectWideTargetsLayout: recognizing the shape", () => {
  test("returns null for a normal single-header-row file (no false positive)", () => {
    const grid = [
      ["Item", "Area", "Rep", "Month", "FCT Val"],
      ["Widget", "North", "Sam", "1", "500"],
      ["Widget", "North", "Sam", "2", "600"],
    ];
    assert.equal(detectWideTargetsLayout(grid, grid), null);
  });

  test("a single month group is not enough to call it wide (avoids matching an incidental label row)", () => {
    const { rawGrid, displayGrid } = buildWideGrid({ months: [1], items: ["Widget"], includeTotal: false });
    assert.equal(detectWideTargetsLayout(rawGrid, displayGrid), null);
  });

  test("empty or too-short input never throws", () => {
    assert.equal(detectWideTargetsLayout([], []), null);
    assert.equal(detectWideTargetsLayout([["Item"]], [["Item"]]), null);
  });

  test("mismatched metric order between months is rejected", () => {
    const { rawGrid, displayGrid } = buildWideGrid({
      months: [1, 2, 3],
      items: ["Widget"],
      includeTotal: false,
      swapMetricOrderForMonth: 2,
    });
    assert.equal(detectWideTargetsLayout(rawGrid, displayGrid), null);
  });
});

describe("detectWideTargetsLayout: unpivoting a real match", () => {
  for (const monthCellStyle of ["merge", "repeat"] as const) {
    test(`6 months + a trailing Total group, header via ${monthCellStyle}-style month cells`, () => {
      const items = ["Glaryl 1mg Tabs", "Lezberg 20mg F.C.Tablets", "Metacardia MR 35mg Tabs"];
      const months = [1, 2, 3, 4, 5, 6];
      const { rawGrid, displayGrid, value } = buildWideGrid({ months, items, includeTotal: true, monthCellStyle });

      const result = detectWideTargetsLayout(rawGrid, displayGrid);
      assert.ok(result, "expected the wide layout to be detected");
      assert.deepEqual(result!.headers, ["Item", "Team", "Month", ...METRICS]);

      // 6 months x 3 items, never 7 (the Total group must not become a month).
      assert.equal(result!.rows.length, 18);

      const monthsSeen = new Set(result!.rows.map((r) => r["Month"]));
      assert.deepEqual([...monthsSeen].sort((a, b) => (a as number) - (b as number)), months);

      // Spot-check exact values for one item/month land in the right columns.
      const row = result!.rows.find((r) => r["Item"] === "Lezberg 20mg F.C.Tablets" && r["Month"] === 4)!;
      assert.ok(row, "expected a row for Lezberg / month 4");
      assert.equal(row["Team"], "Team L");
      METRICS.forEach((name, i) => assert.equal(row[name], value(1, 4, i)));

      // The Total group's sentinel values never appear anywhere in the output.
      const totalSentinels = new Set(METRICS.map((_, i) => 90000 + i));
      for (const r of result!.rows) {
        for (const name of METRICS) assert.ok(!totalSentinels.has(r[name] as number), `Total-group value leaked into ${name}`);
      }
    });
  }

  test("stray label rows above the real header do not block detection", () => {
    const { rawGrid, displayGrid } = buildWideGrid({
      months: [1, 2],
      items: ["Widget"],
      includeTotal: false,
      strayRowsAbove: true,
    });
    const result = detectWideTargetsLayout(rawGrid, displayGrid);
    assert.ok(result);
    assert.equal(result!.rows.length, 2);
  });

  test("a Grand Total row is dropped, not stored as a fake item", () => {
    const { rawGrid, displayGrid } = buildWideGrid({ months: [1, 2, 3], items: ["Widget", "Gadget"], includeTotal: false });
    const grandTotalRow = ["Grand Total", null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    rawGrid.push(grandTotalRow);
    displayGrid.push(grandTotalRow);

    const result = detectWideTargetsLayout(rawGrid, displayGrid);
    assert.ok(result);
    assert.equal(result!.rows.length, 6); // 2 items x 3 months, not 3 x 3
    assert.ok(!result!.rows.some((r) => r["Item"] === "Grand Total"));
  });

  test("any number of months works, not a hardcoded count (12 in one upload)", () => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const { rawGrid, displayGrid } = buildWideGrid({ months, items: ["Widget"], includeTotal: false });
    const result = detectWideTargetsLayout(rawGrid, displayGrid);
    assert.ok(result);
    assert.equal(result!.rows.length, 12);
  });

  test("Item and Team stay two separate columns, never merged into one", () => {
    const { rawGrid, displayGrid } = buildWideGrid({ months: [1, 2], items: ["Widget"], includeTotal: false });
    const result = detectWideTargetsLayout(rawGrid, displayGrid);
    assert.ok(result);
    assert.ok(result!.headers.includes("Item"));
    assert.ok(result!.headers.includes("Team"));
    for (const r of result!.rows) {
      assert.equal(r["Item"], "Widget");
      assert.equal(r["Team"], "Team L");
    }
  });
});
