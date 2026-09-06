// The pieces every upload flow shares: how rows are cut into requests, and
// how the one status-bar slot reports more than one problem at a time.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { UPLOAD_BATCH_SIZE, intoBatches, issueLine, errorText } from "../src/app/lumen/uploadShared.ts";

describe("cutting rows into upload batches", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => i);

  test("a short file is one batch", () => {
    assert.deepEqual(intoBatches([1, 2, 3]), [[1, 2, 3]]);
  });

  test("no rows means no requests at all", () => {
    assert.deepEqual(intoBatches([]), []);
  });

  test("exactly one batch's worth stays one batch", () => {
    const b = intoBatches(rows(UPLOAD_BATCH_SIZE));
    assert.equal(b.length, 1);
    assert.equal(b[0].length, UPLOAD_BATCH_SIZE);
  });

  test("one row over splits, and the remainder is its own batch", () => {
    const b = intoBatches(rows(UPLOAD_BATCH_SIZE + 1));
    assert.equal(b.length, 2);
    assert.equal(b[1].length, 1);
  });

  test("every row is carried, exactly once, in order", () => {
    const all = rows(UPLOAD_BATCH_SIZE * 2 + 7);
    assert.deepEqual(intoBatches(all).flat(), all);
  });

  test("no batch exceeds the request size", () => {
    for (const batch of intoBatches(rows(UPLOAD_BATCH_SIZE * 3 + 5))) {
      assert.ok(batch.length <= UPLOAD_BATCH_SIZE, `batch of ${batch.length}`);
    }
  });
});

describe("reporting more than one upload problem at once", () => {
  test("a warning and a failure both survive", () => {
    // The bug this replaces: a multi-file upload wrote warnings to the
    // status bar and then overwrote them with failures, so the file that
    // uploaded with a suspect row count reported nothing at all.
    const line = issueLine(["a.xlsx: row count does not match"], ["b.xlsx: upload failed"]);
    assert.equal(line, "a.xlsx: row count does not match | b.xlsx: upload failed");
  });

  test("nothing to report leaves the slot alone", () => {
    assert.equal(issueLine([], []), null);
    assert.equal(issueLine(), null);
  });

  test("empty and blank entries are not reported as problems", () => {
    assert.equal(issueLine(["", "   "], null, undefined), null);
    assert.equal(issueLine(["", "real"], "  "), "real");
  });

  test("a bare string counts as one problem", () => {
    assert.equal(issueLine("one", ["two"]), "one | two");
  });

  test("order follows the order the groups were given", () => {
    assert.equal(issueLine(["1", "2"], ["3"]), "1 | 2 | 3");
  });
});

describe("the message shown when something threw", () => {
  test("an Error reports its own message", () => {
    assert.equal(errorText(new Error("boom"), "fallback"), "boom");
  });

  test("anything else falls back", () => {
    assert.equal(errorText("boom", "fallback"), "fallback");
    assert.equal(errorText(null, "fallback"), "fallback");
  });
});
