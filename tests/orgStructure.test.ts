// The org chart: District Manager -> reps -> areas.
//
// Pure derivation over the two record sets (rep assignments, manager
// links), so the shape of a team can be checked without a browser.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  managerForRep,
  knownReps,
  knownManagers,
  areasForRep,
  buildOrgChart,
  areasUnderManager,
  averageSeriesForAreas,
  scopedAreaRanking,
  type AreaScope,
  type ManagerLink,
} from "../src/lib/lumen/orgStructure.ts";
import type { RepAssignment } from "../src/lib/lumen/repAssignments.ts";

let nextId = 0;
const assign = (area: string, rep: string | null, startMonth = 1, endMonth = 12): RepAssignment => ({
  id: `a${nextId++}`, area, rep, startMonth, endMonth,
});
const link = (manager: string, rep: string): ManagerLink => ({ id: `l${nextId++}`, manager, rep });

const figures = (o: Record<string, [number, number | null]>) =>
  Object.fromEntries(Object.entries(o).map(([k, [currValue, pctChange]]) => [k, { currValue, pctChange }]));

describe("a rep can hold several areas", () => {
  const assignments = [
    assign("Cairo", "Sara"),
    assign("Giza", "Sara"),
    assign("Alexandria", "Sara"),
    assign("Luxor", "Omar"),
  ];

  test("every area the rep covers comes back", () => {
    assert.deepEqual(areasForRep(assignments, "Sara").map((a) => a.area), ["Alexandria", "Cairo", "Giza"]);
  });

  test("another rep's areas are not included", () => {
    assert.deepEqual(areasForRep(assignments, "Omar").map((a) => a.area), ["Luxor"]);
  });

  test("months are expanded from the assignment's range", () => {
    const [only] = areasForRep([assign("Cairo", "Sara", 3, 6)], "Sara");
    assert.deepEqual(only.months, [3, 4, 5, 6]);
  });

  test("an area handed over and handed back is ONE entry, with both stretches", () => {
    // Otherwise the same area would appear twice under one rep.
    const split = [assign("Cairo", "Sara", 1, 3), assign("Cairo", "Nour", 4, 6), assign("Cairo", "Sara", 7, 9)];
    const sara = areasForRep(split, "Sara");
    assert.equal(sara.length, 1);
    assert.deepEqual(sara[0].months, [1, 2, 3, 7, 8, 9]);
  });

  test("a vacant stretch belongs to nobody", () => {
    assert.deepEqual(areasForRep([assign("Cairo", null, 1, 6)], "Sara"), []);
  });
});

describe("a manager can hold several reps", () => {
  const links = [link("Hala", "Sara"), link("Hala", "Omar"), link("Karim", "Nour")];
  const assignments = [
    assign("Cairo", "Sara"), assign("Giza", "Sara"),
    assign("Luxor", "Omar"),
    assign("Aswan", "Nour"),
  ];
  const areaFigures = figures({ Cairo: [1000, -5], Giza: [500, 10], Luxor: [700, 0], Aswan: [300, -20] });

  test("each manager gets their own team", () => {
    const chart = buildOrgChart(links, assignments, areaFigures);
    const hala = chart.find((m) => m.manager === "Hala")!;
    assert.deepEqual(hala.reps.map((r) => r.rep), ["Omar", "Sara"]);
    assert.equal(hala.repCount, 2);
  });

  test("a rep's total is the sum of their areas", () => {
    const chart = buildOrgChart(links, assignments, areaFigures);
    const sara = chart.find((m) => m.manager === "Hala")!.reps.find((r) => r.rep === "Sara")!;
    assert.equal(sara.totalValue, 1500);
  });

  test("a manager's total is the sum of their reps", () => {
    const chart = buildOrgChart(links, assignments, areaFigures);
    assert.equal(chart.find((m) => m.manager === "Hala")!.totalValue, 2200);
    assert.equal(chart.find((m) => m.manager === "Karim")!.totalValue, 300);
  });

  test("the areas under a manager are deduplicated across their reps", () => {
    const shared = [...assignments, assign("Cairo", "Omar", 7, 12)];
    const chart = buildOrgChart(links, shared, areaFigures);
    assert.deepEqual(areasUnderManager(chart.find((m) => m.manager === "Hala")!), ["Cairo", "Giza", "Luxor"]);
  });

  test("cards are ordered by team total, so they don't rearrange between loads", () => {
    const chart = buildOrgChart(links, assignments, areaFigures);
    assert.deepEqual(chart.map((m) => m.manager), ["Hala", "Karim"]);
    const reversed = buildOrgChart([...links].reverse(), [...assignments].reverse(), areaFigures);
    assert.deepEqual(reversed.map((m) => m.manager), ["Hala", "Karim"]);
  });

  test("a rep with a manager but no areas yet still appears, at zero", () => {
    // A new hire, or a half-finished reorganisation — vanishing would look
    // like the assignment failed.
    const chart = buildOrgChart([...links, link("Karim", "NewHire")], assignments, areaFigures);
    const karim = chart.find((m) => m.manager === "Karim")!;
    assert.deepEqual(karim.reps.map((r) => r.rep), ["NewHire", "Nour"]);
    assert.equal(karim.reps.find((r) => r.rep === "NewHire")!.totalValue, 0);
  });

  test("an area with no sales figures counts as zero, not as a crash", () => {
    const chart = buildOrgChart([link("Hala", "Sara")], [assign("Unknown Area", "Sara")], {});
    assert.equal(chart[0].reps[0].areas[0].currValue, null);
    assert.equal(chart[0].totalValue, 0);
  });
});

describe("an area handed over mid-year", () => {
  // Found by testing the real card: a rep who held Giza for the first half
  // of the year was still being credited with Giza's LATEST month, which
  // somebody else sold. The area belongs in their history; the money does
  // not belong in their total.
  const assignments = [
    assign("Cairo", "Sara", 1, 12),
    assign("Giza", "Sara", 1, 6),
    assign("Giza", "Nour", 7, 12),
  ];
  const areaFigures = figures({ Cairo: [12000, -8.5], Giza: [5000, 3.2] });
  const links = [link("Hala", "Sara"), link("Hala", "Nour")];

  test("is still listed, with the months it was held", () => {
    const sara = buildOrgChart(links, assignments, areaFigures, 12)[0].reps.find((r) => r.rep === "Sara")!;
    assert.deepEqual(sara.areas.map((a) => a.area), ["Cairo", "Giza"]);
    assert.deepEqual(sara.areas.find((a) => a.area === "Giza")!.months, [1, 2, 3, 4, 5, 6]);
  });

  test("is marked as no longer held", () => {
    const sara = buildOrgChart(links, assignments, areaFigures, 12)[0].reps.find((r) => r.rep === "Sara")!;
    assert.equal(sara.areas.find((a) => a.area === "Cairo")!.currentlyHeld, true);
    assert.equal(sara.areas.find((a) => a.area === "Giza")!.currentlyHeld, false);
  });

  test("does NOT count toward the rep who gave it up", () => {
    const sara = buildOrgChart(links, assignments, areaFigures, 12)[0].reps.find((r) => r.rep === "Sara")!;
    assert.equal(sara.totalValue, 12000);
  });

  test("DOES count toward the rep who holds it now", () => {
    const nour = buildOrgChart(links, assignments, areaFigures, 12)[0].reps.find((r) => r.rep === "Nour")!;
    assert.equal(nour.totalValue, 5000);
  });

  test("the team total counts each area once, not twice", () => {
    // Both reps list Giza; only the current holder may be credited.
    assert.equal(buildOrgChart(links, assignments, areaFigures, 12)[0].totalValue, 17000);
  });

  test("with no month given, every assigned area counts", () => {
    // Nothing to compare against, so nothing to exclude.
    const sara = buildOrgChart(links, assignments, areaFigures)[0].reps.find((r) => r.rep === "Sara")!;
    assert.equal(sara.totalValue, 17000);
  });
});

describe("looking up a rep's manager", () => {
  const links = [link("Hala", "Sara"), link("Karim", "Nour")];

  test("finds the manager", () => assert.equal(managerForRep(links, "Sara"), "Hala"));
  test("a rep with no manager returns null", () => assert.equal(managerForRep(links, "Omar"), null));
  test("no rep at all returns null", () => assert.equal(managerForRep(links, null), null));
  test("no structure defined returns null rather than throwing", () =>
    assert.equal(managerForRep([], "Sara"), null));
});

describe("name lists for the assignment screens", () => {
  test("reps are gathered from assignments, links and the sales data alike", () => {
    const names = knownReps([assign("Cairo", "FromAssignment")], [link("M", "FromLink")], ["FromSales", "FromSales"]);
    assert.deepEqual(names, ["FromAssignment", "FromLink", "FromSales"]);
  });

  test("blank names are not offered", () => {
    assert.deepEqual(knownReps([assign("Cairo", null)], [], [""]), []);
  });

  test("managers are listed once each", () => {
    assert.deepEqual(knownManagers([link("Hala", "A"), link("Hala", "B"), link("Karim", "C")]), ["Hala", "Karim"]);
  });
});

describe("the comparison line inside a scoped view", () => {
  // An area's trend is drawn against a benchmark. On the Sales tab that is
  // the whole line. Inside a rep's block it has to be the rep's own areas,
  // or the chart compares three governorates against thirty.
  const areaSeries = {
    Cairo: { monthlySeries: [{ month: 1, value: 100, qty: 0 }, { month: 2, value: 200, qty: 0 }] },
    Giza: { monthlySeries: [{ month: 1, value: 300, qty: 0 }, { month: 2, value: 400, qty: 0 }] },
    Luxor: { monthlySeries: [{ month: 1, value: 900, qty: 0 }, { month: 2, value: 900, qty: 0 }] },
  };

  test("averages only the areas in scope", () => {
    assert.deepEqual(averageSeriesForAreas(areaSeries, ["Cairo", "Giza"]), [
      { month: 1, avgValue: 200 },
      { month: 2, avgValue: 300 },
    ]);
  });

  test("an area outside the scope does not move the benchmark", () => {
    const withoutLuxor = averageSeriesForAreas(areaSeries, ["Cairo", "Giza"]);
    const withLuxor = averageSeriesForAreas(areaSeries, ["Cairo", "Giza", "Luxor"]);
    assert.notDeepEqual(withoutLuxor, withLuxor);
    assert.equal(withLuxor[0].avgValue, 433);
  });

  test("a scope of one area is that area's own line", () => {
    assert.deepEqual(averageSeriesForAreas(areaSeries, ["Luxor"]), [
      { month: 1, avgValue: 900 },
      { month: 2, avgValue: 900 },
    ]);
  });

  test("a month only some areas have is averaged over the ones that do", () => {
    const partial = {
      A: { monthlySeries: [{ month: 1, value: 100, qty: 0 }, { month: 2, value: 200, qty: 0 }] },
      B: { monthlySeries: [{ month: 1, value: 300, qty: 0 }] },
    };
    assert.deepEqual(averageSeriesForAreas(partial, ["A", "B"]), [
      { month: 1, avgValue: 200 },
      { month: 2, avgValue: 200 },
    ]);
  });

  test("an unknown area contributes nothing rather than throwing", () => {
    assert.deepEqual(averageSeriesForAreas(areaSeries, ["Nowhere"]), []);
  });

  test("months come back in order", () => {
    const jumbled = { A: { monthlySeries: [{ month: 3, value: 30, qty: 0 }, { month: 1, value: 10, qty: 0 }] } };
    assert.deepEqual(averageSeriesForAreas(jumbled, ["A"]).map((p) => p.month), [1, 3]);
  });
});

describe("the \"By area\" list under an item", () => {
  // The reported bug: opening an item beneath a rep who covers three
  // governorates listed every area in the file. Everything under a card
  // has to belong to that card.
  const changes = {
    Cairo: { Panadol: { currValue: 500 }, Brufen: { currValue: 10 } },
    Giza: { Panadol: { currValue: 900 } },
    Luxor: { Panadol: { currValue: 700 } },
    Aswan: { Panadol: { currValue: 100 } },
    Tanta: { Brufen: { currValue: 40 } },
  };

  const scopeOf = (areas: string[]): AreaScope => ({
    areas,
    itemSeries: {},
    hasQuantity: false,
    label: "Sara's areas",
    shortLabel: "Rep's areas",
  });

  test("unscoped, every area that sold the item is listed", () => {
    assert.deepEqual(
      scopedAreaRanking(changes, "Panadol", null).map(([a]) => a),
      ["Giza", "Luxor", "Cairo", "Aswan"],
    );
  });

  test("scoped, only the areas in scope are listed", () => {
    assert.deepEqual(
      scopedAreaRanking(changes, "Panadol", scopeOf(["Cairo", "Aswan"])).map(([a]) => a),
      ["Cairo", "Aswan"],
    );
  });

  test("the scope drops areas, it does not merely reorder them", () => {
    // The bug shipped a list that was correctly sorted and completely
    // wrong. Ranking the same item both ways has to differ in length.
    const all = scopedAreaRanking(changes, "Panadol", null);
    const scoped = scopedAreaRanking(changes, "Panadol", scopeOf(["Cairo", "Aswan"]));
    assert.equal(all.length, 4);
    assert.equal(scoped.length, 2);
    assert.ok(!scoped.some(([a]) => a === "Giza"));
  });

  test("figures come from the area, not from the scope", () => {
    const scoped = scopedAreaRanking(changes, "Panadol", scopeOf(["Cairo", "Giza"]));
    assert.deepEqual(scoped, [["Giza", { currValue: 900 }], ["Cairo", { currValue: 500 }]]);
  });

  test("an area in scope that never sold the item is left out, not shown as zero", () => {
    const scoped = scopedAreaRanking(changes, "Brufen", scopeOf(["Cairo", "Giza", "Aswan"]));
    assert.deepEqual(scoped.map(([a]) => a), ["Cairo"]);
  });

  test("an empty scope shows nothing rather than falling back to everything", () => {
    assert.deepEqual(scopedAreaRanking(changes, "Panadol", scopeOf([])), []);
  });

  test("a scope naming an area with no figures at all is harmless", () => {
    assert.deepEqual(
      scopedAreaRanking(changes, "Panadol", scopeOf(["Cairo", "Nowhere"])).map(([a]) => a),
      ["Cairo"],
    );
  });

  test("ranking stays highest-first inside a scope", () => {
    const values = scopedAreaRanking(changes, "Panadol", scopeOf(["Aswan", "Giza", "Luxor"])).map(
      ([, c]) => c.currValue,
    );
    assert.deepEqual(values, [900, 700, 100]);
  });
});
