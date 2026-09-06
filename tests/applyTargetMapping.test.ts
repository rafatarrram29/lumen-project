// applyTargetMapping turns a mapped RawSheet into ParsedTargetRow[]. These
// pin the achPct scaling fix: an Excel cell genuinely formatted as a
// Percentage stores its raw value as a FRACTION (1.3962 for a cell that
// displays "139.62%"), while the rendered display text is already scaled
// correctly — reading the raw value alone is off by a factor of 100.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { applyTargetMapping, percentCellValue, type RawSheet, type TargetColumnMapping } from "../src/lib/lumen/columnMapping.ts";

const mapping: TargetColumnMapping = {
  area: null,
  rep: null,
  item: "Item",
  month: "Month",
  value: "FCT Val",
  achPct: "Ach %",
};

describe("percentCellValue", () => {
  test("prefers display text, stripping the % sign", () => {
    const sheet: RawSheet = {
      headers: ["Ach %"],
      rows: [{ "Ach %": 1.3962 }],
      displayRows: [{ "Ach %": "139.62%" }],
    };
    assert.equal(percentCellValue(sheet, 0, "Ach %", 1.3962), 139.62);
  });

  test("falls back to the raw value when there is no display text", () => {
    const sheet: RawSheet = { headers: ["Ach %"], rows: [{ "Ach %": 64.29 }] };
    assert.equal(percentCellValue(sheet, 0, "Ach %", 64.29), 64.29);
  });

  test("falls back to raw when the display text is blank or unparseable", () => {
    const sheet: RawSheet = {
      headers: ["Ach %"],
      rows: [{ "Ach %": 50 }],
      displayRows: [{ "Ach %": "" }],
    };
    assert.equal(percentCellValue(sheet, 0, "Ach %", 50), 50);
  });

  test("returns null when nothing at all can be read as a number", () => {
    const sheet: RawSheet = { headers: ["Ach %"], rows: [{ "Ach %": "n/a" }] };
    assert.equal(percentCellValue(sheet, 0, "Ach %", "n/a"), null);
  });
});

describe("applyTargetMapping: achPct scaling", () => {
  test("a genuinely Percentage-formatted cell is read at its displayed scale, not its raw fraction", () => {
    const sheet: RawSheet = {
      headers: ["Item", "Month", "FCT Val", "Ach %"],
      rows: [{ Item: "Widget", Month: 1, "FCT Val": 1000, "Ach %": 1.3962 }],
      displayRows: [{ Item: "Widget", Month: "1", "FCT Val": "1000", "Ach %": "139.62%" }],
    };
    const { rows } = applyTargetMapping(sheet, mapping);
    assert.equal(rows[0].achPct, 139.62);
  });

  test("a plain numeric Ach% cell (no percentage formatting) is unaffected", () => {
    const sheet: RawSheet = {
      headers: ["Item", "Month", "FCT Val", "Ach %"],
      rows: [{ Item: "Widget", Month: 1, "FCT Val": 1000, "Ach %": 64.29 }],
    };
    const { rows } = applyTargetMapping(sheet, mapping);
    assert.equal(rows[0].achPct, 64.29);
  });

  test("an unmapped or unreadable Ach% does not drop the row", () => {
    const sheet: RawSheet = {
      headers: ["Item", "Month", "FCT Val"],
      rows: [{ Item: "Widget", Month: 1, "FCT Val": 1000 }],
    };
    const { rows } = applyTargetMapping(sheet, { ...mapping, achPct: null });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].achPct, null);
  });
});
