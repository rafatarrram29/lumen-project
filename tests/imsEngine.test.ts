// Market Insights: the two rankings, and why they are not the same number.
//
// The bug these exist for: the Market Share card showed the COMPETITIVE
// rank (us against competitor brands for one product), so on a file with
// no competitor rows every single product read "Rank #1 of 1 in category"
// — while the Market Ranking list beside it correctly ranked those same
// products 1, 2, 3 by share.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildImsReport } from "../src/lib/lumen/imsEngine.ts";
import { imsGroupLabel } from "../src/lib/lumen/imsLabels.ts";
import type { ImsRecord } from "../src/lib/lumen/imsEngine.ts";

const OURS = "Our Pharma";

function rec(o: {
  product?: string | null;
  area?: string | null;
  company?: string | null;
  share: number;
  month: number;
  growthRate?: number | null;
}): ImsRecord {
  return {
    area: o.area ?? null,
    product: o.product ?? null,
    company: o.company === undefined ? OURS : o.company,
    marketShare: o.share,
    month: o.month,
    growthRate: o.growthRate ?? null,
  };
}

/** The real-world shape: several of our products, no competitor rows at all. */
const noCompetitors: ImsRecord[] = [
  rec({ product: "EMPACOZA PLUS", share: 44, month: 1 }),
  rec({ product: "EMPACOZA PLUS", share: 49.1, month: 2 }),
  rec({ product: "DIACURIMAP PLUS", share: 19, month: 1 }),
  rec({ product: "DIACURIMAP PLUS", share: 21.0, month: 2 }),
  rec({ product: "THIRD BRAND", share: 8, month: 1 }),
  rec({ product: "THIRD BRAND", share: 9.4, month: 2 }),
];

const byLabel = (report: ReturnType<typeof buildImsReport>) =>
  new Map(report.areaProducts.map((ap) => [imsGroupLabel(ap), ap]));

describe("portfolio rank — where a product sits among the others", () => {
  test("products are ranked against each other by share", () => {
    const groups = byLabel(buildImsReport(noCompetitors, [OURS]));
    assert.equal(groups.get("EMPACOZA PLUS")!.portfolioRank, 1);
    assert.equal(groups.get("DIACURIMAP PLUS")!.portfolioRank, 2);
    assert.equal(groups.get("THIRD BRAND")!.portfolioRank, 3);
  });

  test("every product knows how many it is ranked against", () => {
    for (const ap of buildImsReport(noCompetitors, [OURS]).areaProducts) {
      assert.equal(ap.portfolioTotal, 3);
    }
  });

  test("THE BUG: with no competitors, no two products may share a rank", () => {
    // Previously every one of these was "1 of 1".
    const ranks = buildImsReport(noCompetitors, [OURS]).areaProducts.map((ap) => ap.portfolioRank);
    assert.deepEqual([...ranks].sort(), [1, 2, 3]);
    assert.equal(new Set(ranks).size, 3, "products shared a rank");
  });

  test("the ranking follows the LATEST month, not the first", () => {
    // A product can overtake another between months; the card and the list
    // both describe where things stand now.
    const overtake: ImsRecord[] = [
      rec({ product: "Riser", share: 10, month: 1 }),
      rec({ product: "Riser", share: 60, month: 2 }),
      rec({ product: "Faller", share: 50, month: 1 }),
      rec({ product: "Faller", share: 20, month: 2 }),
    ];
    const groups = byLabel(buildImsReport(overtake, [OURS]));
    assert.equal(groups.get("Riser")!.portfolioRank, 1);
    assert.equal(groups.get("Faller")!.portfolioRank, 2);
  });

  test("a product with no latest-month share ranks last, not first", () => {
    const partial: ImsRecord[] = [
      rec({ product: "Present", share: 5, month: 2 }),
      rec({ product: "Missing", share: 90, month: 1 }),
    ];
    const groups = byLabel(buildImsReport(partial, [OURS]));
    assert.equal(groups.get("Present")!.portfolioRank, 1);
    assert.equal(groups.get("Missing")!.portfolioRank, 2);
  });

  test("an exact tie resolves the same way every time", () => {
    const tied: ImsRecord[] = [
      rec({ product: "Zeta", share: 25, month: 1 }),
      rec({ product: "Alpha", share: 25, month: 1 }),
      rec({ product: "Zeta", share: 25, month: 2 }),
      rec({ product: "Alpha", share: 25, month: 2 }),
    ];
    const forward = byLabel(buildImsReport(tied, [OURS]));
    const reversed = byLabel(buildImsReport([...tied].reverse(), [OURS]));
    assert.equal(forward.get("Alpha")!.portfolioRank, 1);
    assert.equal(reversed.get("Alpha")!.portfolioRank, 1);
  });
});

describe("competitive rank — where we sit against competitor brands", () => {
  const withCompetitors: ImsRecord[] = [
    rec({ product: "Contested", share: 30, month: 1 }),
    rec({ product: "Contested", share: 30, month: 2 }),
    rec({ product: "Contested", company: "Rival A", share: 45, month: 2 }),
    rec({ product: "Contested", company: "Rival B", share: 25, month: 2 }),
    rec({ product: "Uncontested", share: 70, month: 1 }),
    rec({ product: "Uncontested", share: 70, month: 2 }),
  ];

  test("we are ranked among the competitors for that product", () => {
    const groups = byLabel(buildImsReport(withCompetitors, [OURS]));
    assert.equal(groups.get("Contested")!.rank, 2);
    assert.equal(groups.get("Contested")!.totalInGroup, 3);
  });

  test("a product with no competitor rows is 1 of 1 — which is why the card can't rely on it", () => {
    const groups = byLabel(buildImsReport(withCompetitors, [OURS]));
    assert.equal(groups.get("Uncontested")!.rank, 1);
    assert.equal(groups.get("Uncontested")!.totalInGroup, 1);
  });

  test("the two ranks are independent: leading the portfolio while losing the category", () => {
    // Uncontested leads our portfolio (70% vs 30%) but is 1-of-1
    // competitively; Contested trails our portfolio yet sits 2nd of 3
    // against real rivals. Reporting either number as the other is wrong.
    const groups = byLabel(buildImsReport(withCompetitors, [OURS]));
    assert.equal(groups.get("Uncontested")!.portfolioRank, 1);
    assert.equal(groups.get("Uncontested")!.rank, 1);
    assert.equal(groups.get("Contested")!.portfolioRank, 2);
    assert.equal(groups.get("Contested")!.rank, 2);
    assert.equal(groups.get("Contested")!.totalInGroup, 3);
    assert.equal(groups.get("Uncontested")!.totalInGroup, 1);
  });
});

describe("the list and the card read the same field", () => {
  test("sorting groups by portfolioRank reproduces the share order", () => {
    const report = buildImsReport(noCompetitors, [OURS]);
    const listOrder = [...report.areaProducts]
      .sort((a, b) => (a.portfolioRank ?? Infinity) - (b.portfolioRank ?? Infinity))
      .map((ap) => imsGroupLabel(ap));
    assert.deepEqual(listOrder, ["EMPACOZA PLUS", "DIACURIMAP PLUS", "THIRD BRAND"]);

    // and each row's position matches the rank the card would print
    listOrder.forEach((label, i) => {
      assert.equal(byLabel(report).get(label)!.portfolioRank, i + 1);
    });
  });
});
