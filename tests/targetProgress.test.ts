// Target vs Achievement: the arithmetic behind every figure a rep or a
// district manager is asked about.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  achievement,
  buildProgress,
  rollUpTeam,
  actualsInScope,
  targetsInScope,
  ACH_MISMATCH_TOLERANCE,
  type ActualRow,
  type TargetRow,
} from "../src/lib/lumen/targetProgress.ts";

const act = (area: string, item: string, month: number, value: number, rep: string | null = null): ActualRow =>
  ({ area, item, rep, month, value });
const tgt = (
  o: Partial<TargetRow> & { month: number; targetValue: number },
): TargetRow => ({ area: null, rep: null, item: null, achPct: null, isManual: false, ...o });

describe("achievement as a percentage", () => {
  test("sales over target, to one decimal", () => {
    assert.equal(achievement(750, 1000), 75);
    assert.equal(achievement(1234, 1000), 123.4);
  });

  test("no target means no percentage, not zero", () => {
    // A territory with no plan is not at 0% — it is unmeasured, and
    // colouring it red would put a rep on a list they do not belong on.
    assert.equal(achievement(500, 0), null);
    assert.equal(achievement(500, NaN), null);
    assert.equal(achievement(500, -100), null);
  });

  test("no sales against a real target is a real zero", () => {
    assert.equal(achievement(0, 1000), 0);
  });
});

describe("scoping rows to one part of the org chart", () => {
  const actuals = [
    act("Cairo", "Panadol", 1, 100, "Sara"),
    act("Giza", "Panadol", 1, 200, "Sara"),
    act("Luxor", "Panadol", 1, 900, "Omar"),
  ];

  test("a rep's areas only", () => {
    const got = actualsInScope(actuals, { areas: ["Cairo", "Giza"] });
    assert.deepEqual(got.map((r) => r.area), ["Cairo", "Giza"]);
  });

  test("scoping by rep ignores whose area it is called", () => {
    assert.deepEqual(actualsInScope(actuals, { rep: "Omar" }).map((r) => r.area), ["Luxor"]);
  });

  test("an unscoped call keeps everything", () => {
    assert.equal(actualsInScope(actuals, {}).length, 3);
  });

  test("a rep-level target with no area still counts toward that rep", () => {
    // Uploaded from inside a rep's card, a plan row often carries no area
    // at all — the context supplied it. Dropping those would show the rep
    // a target of zero.
    const targets = [tgt({ rep: "Sara", month: 1, targetValue: 5000 })];
    assert.equal(targetsInScope(targets, { rep: "Sara", areas: ["Cairo", "Giza"] }).length, 1);
  });

  test("an area-level target with no rep still counts toward that area", () => {
    const targets = [tgt({ area: "Cairo", month: 1, targetValue: 900 })];
    assert.equal(targetsInScope(targets, { areas: ["Cairo"] }).length, 1);
  });

  test("a row belonging to nobody is left out of every scope", () => {
    const targets = [tgt({ month: 1, targetValue: 100 })];
    assert.equal(targetsInScope(targets, { rep: "Sara" }).length, 0);
    assert.equal(targetsInScope(targets, { areas: ["Cairo"] }).length, 0);
    assert.equal(targetsInScope(targets, {}).length, 1);
  });

  test("another rep's row is excluded even when the area matches", () => {
    const targets = [tgt({ rep: "Omar", area: "Cairo", month: 1, targetValue: 100 })];
    assert.equal(targetsInScope(targets, { rep: "Sara", areas: ["Cairo"] }).length, 0);
  });
});

describe("one rep's comparison", () => {
  const scope = { rep: "Sara", areas: ["Cairo", "Giza"] };
  const actuals = [
    act("Cairo", "Panadol", 1, 400, "Sara"), act("Cairo", "Brufen", 1, 100, "Sara"),
    act("Cairo", "Panadol", 2, 300, "Sara"), act("Cairo", "Brufen", 2, 200, "Sara"),
    act("Luxor", "Panadol", 1, 9999, "Omar"),
  ];
  const targets = [
    tgt({ rep: "Sara", item: "Panadol", month: 1, targetValue: 500 }),
    tgt({ rep: "Sara", item: "Brufen", month: 1, targetValue: 200 }),
    tgt({ rep: "Sara", item: "Panadol", month: 2, targetValue: 500 }),
    tgt({ rep: "Sara", item: "Brufen", month: 2, targetValue: 200 }),
    tgt({ rep: "Omar", item: "Panadol", month: 1, targetValue: 9000 }),
  ];

  test("months come back in order, with sales beside target", () => {
    const p = buildProgress(actuals, targets, scope);
    assert.deepEqual(p.months, [
      { month: 1, sales: 500, target: 700, achPct: 71.4 },
      { month: 2, sales: 500, target: 700, achPct: 71.4 },
    ]);
  });

  test("another rep's numbers never leak in", () => {
    // Tiles describe the focus month — the latest, here month 2.
    const p = buildProgress(actuals, targets, scope);
    assert.equal(p.focusMonth, 2);
    assert.equal(p.totalSales, 500);
    assert.equal(p.totalTarget, 700);
    assert.equal(p.achPct, 71.4);
  });

  test("the tiles and the item list describe the same month", () => {
    // The trap this pins: an item row showing a period total beside an
    // input that replaces one month's figure. Typing the row's own number
    // back in must be a no-op, so the two have to be the same month.
    const p = buildProgress(actuals, targets, scope);
    const itemTargets = p.items.reduce((sum, i) => sum + i.target, 0);
    assert.equal(itemTargets, p.totalTarget);
    const itemSales = p.items.reduce((sum, i) => sum + i.sales, 0);
    assert.equal(itemSales, p.totalSales);
  });

  test("an explicit focus month overrides the default", () => {
    const p = buildProgress(actuals, targets, scope, 1);
    assert.equal(p.focusMonth, 1);
    assert.equal(p.totalSales, 500);
    assert.deepEqual(p.items.map((i) => [i.item, i.achPct]), [["Brufen", 50], ["Panadol", 80]]);
  });

  test("items are listed worst-achieving first", () => {
    const p = buildProgress(actuals, targets, scope);
    // Month 2: Panadol 300/500 = 60%, Brufen 200/200 = 100%.
    assert.deepEqual(p.items.map((i) => [i.item, i.achPct]), [["Panadol", 60], ["Brufen", 100]]);
  });

  test("the chart still covers every month, not just the focus one", () => {
    const p = buildProgress(actuals, targets, scope);
    assert.deepEqual(p.months.map((m) => m.month), [1, 2]);
  });

  test("an item with sales but no target sinks to the bottom, unmeasured", () => {
    const p = buildProgress([...actuals, act("Cairo", "Congestal", 2, 50, "Sara")], targets, scope);
    const last = p.items[p.items.length - 1];
    assert.equal(last.item, "Congestal");
    assert.equal(last.achPct, null);
  });

  test("a scope-wide target row counts toward the total but not any item", () => {
    const withOverall = [...targets, tgt({ rep: "Sara", month: 2, targetValue: 100 })];
    const p = buildProgress(actuals, withOverall, scope);
    assert.equal(p.totalTarget, 800);
    assert.deepEqual(p.items.map((i) => i.item).sort(), ["Brufen", "Panadol"]);
  });

  test("a month with a target and no sales reports zero, not nothing", () => {
    const p = buildProgress(
      [act("Cairo", "Panadol", 1, 400, "Sara")],
      [tgt({ rep: "Sara", item: "Panadol", month: 1, targetValue: 500 }),
       tgt({ rep: "Sara", item: "Panadol", month: 2, targetValue: 500 })],
      scope,
    );
    assert.deepEqual(p.months[1], { month: 2, sales: 0, target: 500, achPct: 0 });
  });

  test("a period with no data at all has no focus month", () => {
    const p = buildProgress([], [], scope);
    assert.equal(p.focusMonth, null);
    assert.equal(p.achPct, null);
    assert.deepEqual(p.items, []);
  });

  test("a month with sales and no target is unmeasured, not failing", () => {
    const p = buildProgress(
      [act("Cairo", "Panadol", 1, 400, "Sara"), act("Cairo", "Panadol", 2, 400, "Sara")],
      [tgt({ rep: "Sara", item: "Panadol", month: 1, targetValue: 500 })],
      scope,
    );
    assert.equal(p.months[1].achPct, null);
  });
});

describe("the file's own Ach% against ours", () => {
  const scope = { rep: "Sara" };
  const base = [act("Cairo", "Panadol", 1, 700, "Sara")];

  test("a figure that agrees is not reported", () => {
    const p = buildProgress(base, [tgt({ rep: "Sara", item: "Panadol", month: 1, targetValue: 1000, achPct: 70 })], scope);
    assert.deepEqual(p.mismatches, []);
  });

  test("rounding in the plan file is tolerated", () => {
    const p = buildProgress(base, [tgt({ rep: "Sara", item: "Panadol", month: 1, targetValue: 1000, achPct: 71.5 })], scope);
    assert.deepEqual(p.mismatches, []);
  });

  test("a real disagreement is reported with both numbers", () => {
    const p = buildProgress(base, [tgt({ rep: "Sara", item: "Panadol", month: 1, targetValue: 1000, achPct: 95 })], scope);
    assert.deepEqual(p.mismatches, [{ label: "Panadol · M1", fileAchPct: 95, computedAchPct: 70 }]);
  });

  test("the file's figure is reported, never substituted for ours", () => {
    const p = buildProgress(base, [tgt({ rep: "Sara", item: "Panadol", month: 1, targetValue: 1000, achPct: 95 })], scope);
    assert.equal(p.items[0].achPct, 70, "the computed figure is what the card shows");
    assert.equal(p.items[0].fileAchPct, 95);
  });

  test("exactly at the tolerance is still agreement", () => {
    const p = buildProgress(base, [tgt({ rep: "Sara", item: "Panadol", month: 1, targetValue: 1000, achPct: 70 + ACH_MISMATCH_TOLERANCE })], scope);
    assert.deepEqual(p.mismatches, []);
  });

  test("one wrong month is reported even when the item's average looks fine", () => {
    // The bug this pins: five honest months and one claiming 99.4% average
    // to well inside the tolerance, so comparing the item's average hid
    // the single figure that was wrong.
    const months = [1, 2, 3, 4, 5, 6];
    const sales = months.map((m) => act("Cairo", "Panadol", m, 920, "Sara"));
    const plans = months.map((m) =>
      tgt({ rep: "Sara", item: "Panadol", month: m, targetValue: 1000, achPct: m === 6 ? 99.4 : 92 }),
    );
    const p = buildProgress(sales, plans, scope);
    assert.deepEqual(p.mismatches, [{ label: "Panadol · M6", fileAchPct: 99.4, computedAchPct: 92 }]);
  });

  test("an item with no target cannot disagree with anything", () => {
    const p = buildProgress(base, [tgt({ rep: "Sara", item: "Panadol", month: 1, targetValue: 0, achPct: 95 })], scope);
    assert.deepEqual(p.mismatches, []);
  });

  test("a manual row is marked so the card can show it differently", () => {
    const p = buildProgress(base, [tgt({ rep: "Sara", item: "Panadol", month: 1, targetValue: 1000, isManual: true })], scope);
    assert.equal(p.items[0].isManual, true);
  });
});

describe("rolling a team up to its manager", () => {
  const member = (rep: string, sales: number, target: number, month = 1) => ({
    rep,
    progress: buildProgress(
      [act(`${rep} area`, "Panadol", month, sales, rep)],
      [tgt({ rep, item: "Panadol", month, targetValue: target })],
      { rep },
    ),
  });

  test("the team percentage is total over total, not an average of percentages", () => {
    // Sara: 100/100 = 100%. Omar: 100/900 = 11.1%. Averaging the two
    // percentages gives 55.6% and hides that the team missed by 800.
    const team = rollUpTeam([member("Sara", 100, 100), member("Omar", 100, 900)], 70);
    assert.equal(team.totalSales, 200);
    assert.equal(team.totalTarget, 1000);
    assert.equal(team.achPct, 20);
    assert.notEqual(team.achPct, 55.6);
  });

  test("months are summed across the team", () => {
    const team = rollUpTeam(
      [member("Sara", 100, 200, 1), member("Omar", 300, 400, 1)],
      70,
    );
    assert.deepEqual(team.months, [{ month: 1, sales: 400, target: 600, achPct: 66.7 }]);
  });

  test("a month only one rep has still appears", () => {
    const team = rollUpTeam([member("Sara", 100, 200, 1), member("Omar", 300, 400, 2)], 70);
    assert.deepEqual(team.months.map((m) => m.month), [1, 2]);
  });

  test("reps under the threshold are named, worst first", () => {
    const team = rollUpTeam(
      [member("Sara", 100, 100), member("Omar", 50, 100), member("Nadia", 10, 100)],
      70,
    );
    assert.deepEqual(team.belowTarget, ["Nadia", "Omar"]);
    assert.equal(team.measuredCount, 3);
  });

  test("exactly on the threshold is not below it", () => {
    const team = rollUpTeam([member("Sara", 70, 100)], 70);
    assert.deepEqual(team.belowTarget, []);
  });

  test("a rep with no target is not counted as failing", () => {
    const team = rollUpTeam([member("Sara", 100, 100), member("Omar", 500, 0)], 70);
    assert.deepEqual(team.belowTarget, []);
    assert.equal(team.measuredCount, 1, "only the rep with a plan is measured");
  });

  test("a rep with no plan does not inflate the team's achievement", () => {
    // The bug this pins: Omar's 500 in sales with nothing to divide by
    // turned a team at 100% into a team at 600%, which reads as a district
    // comfortably ahead rather than one only half measured.
    const team = rollUpTeam([member("Sara", 100, 100), member("Omar", 500, 0)], 70);
    assert.equal(team.totalSales, 100);
    assert.equal(team.totalTarget, 100);
    assert.equal(team.achPct, 100);
    assert.deepEqual(team.unmeasured, ["Omar"]);
  });

  test("an unplanned rep is left out of the monthly chart too", () => {
    const team = rollUpTeam([member("Sara", 100, 200, 1), member("Omar", 900, 0, 1)], 70);
    assert.deepEqual(team.months, [{ month: 1, sales: 100, target: 200, achPct: 50 }]);
  });

  test("every rep is still listed, planned or not", () => {
    const team = rollUpTeam([member("Sara", 100, 100), member("Omar", 500, 0)], 70);
    assert.deepEqual(team.members.map((m) => m.rep), ["Sara", "Omar"]);
  });

  test("the team's items are summed and sorted worst first", () => {
    const team = rollUpTeam([member("Sara", 100, 100), member("Omar", 100, 900)], 70);
    assert.deepEqual(team.items, [
      { item: "Panadol", sales: 200, target: 1000, achPct: 20, fileAchPct: null, isManual: false },
    ]);
  });

  test("the team's item list is the same month as its tiles", () => {
    const team = rollUpTeam([member("Sara", 100, 100, 2), member("Omar", 300, 400, 2)], 70);
    assert.equal(team.focusMonth, 2);
    assert.equal(team.items.reduce((s, i) => s + i.target, 0), team.totalTarget);
  });

  test("each rep's mismatches are carried up, named by rep", () => {
    const sara = {
      rep: "Sara",
      progress: buildProgress(
        [act("Cairo", "Panadol", 1, 700, "Sara")],
        [tgt({ rep: "Sara", item: "Panadol", month: 1, targetValue: 1000, achPct: 95 })],
        { rep: "Sara" },
      ),
    };
    const team = rollUpTeam([sara], 70);
    assert.deepEqual(team.mismatches.map((m) => m.label), ["Sara · Panadol · M1"]);
  });

  test("an empty team is unmeasured rather than zero", () => {
    const team = rollUpTeam([], 70);
    assert.equal(team.achPct, null);
    assert.deepEqual(team.months, []);
    assert.equal(team.measuredCount, 0);
    assert.deepEqual(team.unmeasured, []);
  });
});
