// Pre-filling the targets mapping dialog.
//
// The dialog used to open with every field on "Select a column…" for files
// whose headers plainly said what they were. These pin the vocabulary it
// understands, and — more importantly — the assignment rule that stops one
// field taking a header another field needed.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { guessTargetMapping } from "../src/lib/lumen/columnMapping.ts";

describe("the file this was reported against", () => {
  const headers = ["Area", "Rep", "Parent Item", "Month", "FCT Val", "Ach %"];

  test("every field is filled in, with nothing left to pick by hand", () => {
    assert.deepEqual(guessTargetMapping(headers), {
      area: "Area",
      rep: "Rep",
      item: "Parent Item",
      month: "Month",
      value: "FCT Val",
      achPct: "Ach %",
    });
  });

  test("column order in the file makes no difference", () => {
    const shuffled = ["Ach %", "FCT Val", "Month", "Parent Item", "Rep", "Area"];
    assert.deepEqual(guessTargetMapping(shuffled), guessTargetMapping(headers));
  });
});

describe("the wording a plan file might use", () => {
  const cases: [string, string[], Record<string, string>][] = [
    ["governorate and BU rep", ["Governorate", "BU Rep", "Parent Item", "Month", "FCT Value", "Ach%"],
      { area: "Governorate", rep: "BU Rep", item: "Parent Item", month: "Month", value: "FCT Value", achPct: "Ach%" }],
    ["forecast wording", ["Region", "Sales Rep", "Product", "Month", "Forecast Value", "Achievement %"],
      { area: "Region", rep: "Sales Rep", item: "Product", month: "Month", value: "Forecast Value", achPct: "Achievement %" }],
    ["underscores and dashes", ["AREA_NAME", "MEDICAL-REP", "PRODUCT", "MONTH", "TARGET_VALUE"],
      { area: "AREA_NAME", rep: "MEDICAL-REP", item: "PRODUCT", month: "MONTH", value: "TARGET_VALUE" }],
    ["a budget rather than a target", ["Territory", "Agent", "SKU", "Period", "Budget Amount"],
      { area: "Territory", rep: "Agent", item: "SKU", month: "Period", value: "Budget Amount" }],
  ];

  for (const [name, headers, expected] of cases) {
    test(name, () => {
      const got = guessTargetMapping(headers);
      for (const [field, header] of Object.entries(expected)) {
        assert.equal(got[field as keyof typeof got], header, `${field} should be "${header}", got "${got[field as keyof typeof got]}"`);
      }
    });
  }
});

describe("one field must not take a header another field needs", () => {
  test('"Report Month" is the month, not the rep', () => {
    // The bug this pins: "rep" appears inside "report", the old scorer took
    // it for the rep column, and Month was then left unmapped.
    const got = guessTargetMapping(["Report Month", "Sales Rep", "Item", "FCT Val"]);
    assert.equal(got.month, "Report Month");
    assert.equal(got.rep, "Sales Rep");
  });

  test('"Target Ach %" is the achievement, not the target value', () => {
    const got = guessTargetMapping(["Area", "Item", "Month", "Target Val", "Target Ach %"]);
    assert.equal(got.value, "Target Val");
    assert.equal(got.achPct, "Target Ach %");
  });

  test("the qualified column wins over the bare one", () => {
    const got = guessTargetMapping(["Area", "Item", "Month", "FCT", "FCT Val"]);
    assert.equal(got.value, "FCT Val");
  });

  test("no header is ever mapped to two fields", () => {
    // "Area Rep" answers to both Area and Rep. One of them has to lose it,
    // or the same column is read as two different things.
    const got = guessTargetMapping(["Area Rep", "Item", "Month", "Target"]);
    const used = Object.values(got);
    assert.equal(new Set(used).size, used.length, `duplicate mapping: ${JSON.stringify(got)}`);
    assert.equal(got.area, "Area Rep");
    assert.equal(got.rep, undefined);
  });

  test("an exact name beats a longer one that merely contains it", () => {
    // Declaration order would take "Report Month" first; the exact match
    // has to outrank it however the columns happen to be ordered.
    assert.equal(guessTargetMapping(["Report Month", "Month"]).month, "Month");
    assert.equal(guessTargetMapping(["Month", "Report Month"]).month, "Month");
  });

  test("a whole-word match beats a bare substring", () => {
    // "forecast" sits inside "Forecasting Notes" but IS a word in "Sales
    // Forecast" — the second is the plan column, the first is a comment.
    assert.equal(guessTargetMapping(["Forecasting Notes", "Sales Forecast"]).value, "Sales Forecast");
  });

  test("a Val/Value/Amount qualifier decides between two equal candidates", () => {
    // Both are "Plan" columns as far as the keyword goes; only one holds
    // the number.
    assert.equal(guessTargetMapping(["Plan Notes", "Plan Value"]).value, "Plan Value");
    assert.equal(guessTargetMapping(["Plan Owner", "Plan Amount"]).value, "Plan Amount");
  });
});

describe("what it declines to guess", () => {
  test("a file of unrelated columns maps nothing rather than guessing wildly", () => {
    assert.deepEqual(guessTargetMapping(["Notes", "Colour", "Serial"]), {});
  });

  test("no headers at all is not an error", () => {
    assert.deepEqual(guessTargetMapping([]), {});
  });

  test("a short keyword never matches inside a longer word", () => {
    // "ach" inside "Machine", "rep" inside "Reporting", "gov" inside
    // "Governance" — none of these are the column they resemble.
    const got = guessTargetMapping(["Machine", "Reporting Tool", "Governance"]);
    assert.equal(got.achPct, undefined);
    assert.equal(got.rep, undefined);
    assert.equal(got.area, undefined);
  });

  test("the same file always maps the same way", () => {
    const headers = ["Area", "Region", "Rep", "Item", "Product", "Month", "Target", "FCT Val"];
    assert.deepEqual(guessTargetMapping(headers), guessTargetMapping(headers));
  });
});

describe("a combined Sales-vs-Target export", () => {
  test("Sales Val/Sales Qty map to their own fields, never stealing FCT Val's spot", () => {
    const headers = ["Item", "Team", "Month", "Sales Qty", "FCT Qty", "Sales Val", "FCT Val", "Ach %"];
    const got = guessTargetMapping(headers);
    assert.equal(got.value, "FCT Val");
    assert.equal(got.salesValue, "Sales Val");
    assert.equal(got.salesQty, "Sales Qty");
    assert.equal(got.achPct, "Ach %");
    // "FCT Qty" answers to nothing here — there's no target-quantity field.
    assert.equal(Object.values(got).includes("FCT Qty"), false);
  });

  test("plain wording variants", () => {
    assert.equal(guessTargetMapping(["Item", "Month", "FCT Val", "Actual Sales"]).salesValue, "Actual Sales");
    assert.equal(guessTargetMapping(["Item", "Month", "FCT Val", "Actual Qty"]).salesQty, "Actual Qty");
  });

  test("a plain long-format file with no sales columns leaves both unmapped", () => {
    const got = guessTargetMapping(["Area", "Rep", "Item", "Month", "FCT Val", "Ach %"]);
    assert.equal(got.salesValue, undefined);
    assert.equal(got.salesQty, undefined);
  });
});
