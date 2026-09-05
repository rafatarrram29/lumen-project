// The export checklist. Market Insights used to be missing from it
// entirely — the one section of the dashboard a reader of the exported
// PDF or deck could not get.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildExportItems, allItemIds } from "../src/lib/lumen/exportItems.ts";
import { imsGroupLabel } from "../src/lib/lumen/imsLabels.ts";
import { buildReport } from "../src/lib/lumen/engine.ts";
import { translations } from "../src/lib/i18n/translations.ts";
import type { ImsAreaProduct, ImsReport } from "../src/lib/lumen/imsEngine.ts";
import { areaSeries, ok } from "./helpers.ts";

const t = translations.en;
const report = ok(buildReport(areaSeries({ Alpha: [1000, 800], Beta: [1000, 1200] }), 2025));

function group(o: Partial<ImsAreaProduct> & { product?: string | null; area?: string | null }): ImsAreaProduct {
  return {
    area: null,
    product: null,
    series: [],
    latestShare: 12.5,
    prevShare: 11,
    pctPointChange: 1.5,
    topCompetitor: null,
    rank: 2,
    totalInGroup: 5,
    ourGrowthRate: 8,
    marketGrowthRate: 4,
    ...o,
  } as ImsAreaProduct;
}

function imsReport(areaProducts: ImsAreaProduct[]): ImsReport {
  return {
    hasCompetitors: true,
    ownCompanies: ["Us"],
    months: [1, 2],
    latestMonth: 2,
    prevMonth: 1,
    areaProducts,
    findings: [],
  };
}

describe("imsGroupLabel", () => {
  test("prefers the product", () => {
    assert.equal(imsGroupLabel(group({ product: "Drug A", area: "Cairo" })), "Drug A");
  });

  test("falls back to the area when there is no product", () => {
    assert.equal(imsGroupLabel(group({ product: null, area: "Cairo" })), "Cairo");
  });

  test("has something to show even when the group has neither", () => {
    assert.equal(imsGroupLabel(group({ product: null, area: null })), "—");
  });
});

describe("buildExportItems", () => {
  test("with no Market Insights data, the checklist is unchanged", () => {
    const groups = buildExportItems(report, t);
    assert.equal(groups.find((g) => g.group === "market"), undefined);
    // and the sales side is still all there
    assert.ok(groups.some((g) => g.group === "areas"));
    assert.ok(groups.some((g) => g.group === "items"));
  });

  test("an empty Market Insights report adds no empty section", () => {
    const groups = buildExportItems(report, t, imsReport([]));
    assert.equal(groups.find((g) => g.group === "market"), undefined);
  });

  test("each Market Insights group becomes a selectable entry", () => {
    const groups = buildExportItems(
      report,
      t,
      imsReport([group({ product: "Drug A" }), group({ product: "Drug B" }), group({ area: "Cairo" })]),
    );
    const market = groups.find((g) => g.group === "market");
    assert.ok(market, "no market group in the checklist");
    assert.deepEqual(market!.items.map((i) => i.label), ["Drug A", "Drug B", "Cairo"]);
  });

  test("entries are keyed by position, so two groups with the same name stay distinct", () => {
    // A group's identity is an (area, product) pair, and two areas can
    // carry the same product name — keying by label would collapse them
    // into one checkbox that exports the wrong thing.
    const groups = buildExportItems(
      report,
      t,
      imsReport([group({ product: "Drug A", area: "Cairo" }), group({ product: "Drug A", area: "Giza" })]),
    );
    const ids = groups.find((g) => g.group === "market")!.items.map((i) => i.id);
    assert.deepEqual(ids, ["ims:0", "ims:1"]);
    assert.equal(new Set(ids).size, 2);
  });

  test("the ids line up with the order the exporters walk", () => {
    // Both exporters do areaProducts.forEach((ap, i) => isSelected(`ims:${i}`)),
    // so a checklist id that didn't match the index would export a
    // different group than the one ticked.
    const products = [group({ product: "A" }), group({ product: "B" }), group({ product: "C" })];
    const market = buildExportItems(report, t, imsReport(products)).find((g) => g.group === "market")!;
    products.forEach((ap, i) => {
      assert.equal(market.items[i].id, `ims:${i}`);
      assert.equal(market.items[i].label, imsGroupLabel(ap));
    });
  });

  test("select-all covers the Market Insights entries too", () => {
    const groups = buildExportItems(report, t, imsReport([group({ product: "Drug A" })]));
    assert.ok(allItemIds(groups).includes("ims:0"));
  });
});
