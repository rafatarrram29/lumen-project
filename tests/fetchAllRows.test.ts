// Pagination correctness. `.range(from, to)` only means anything against a
// defined order — an unordered query may come back in a different order on
// each call, and two pages taken from two different orderings can repeat one
// row and drop another while the total count still looks plausible.
//
// The fake below models exactly that: a server that serves rows in a
// different rotation on every request UNLESS the query asked for an order.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fetchAllRows } from "../src/lib/lumen/fetchAllRows.ts";
import type { PageableQuery } from "../src/lib/lumen/fetchAllRows.ts";

type Row = { id: string; n: number };

function rows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    // zero-padded so lexicographic order matches numeric order
    id: `row-${String(i).padStart(5, "0")}`,
    n: i,
  }));
}

type Call = { orderedBy: string | null; ascending: boolean | null; from: number; to: number };

/**
 * A fake PostgREST table. Its defining behaviour: with no ORDER BY it
 * serves a different rotation of the rows on every call — the same freedom
 * a real Postgres has, and the reason paging without an order is unsound.
 */
function fakeTable(all: Row[], opts: { failOnCall?: number } = {}) {
  const calls: Call[] = [];
  let served = 0;

  const build = (): PageableQuery<Row> => {
    let orderedBy: string | null = null;
    let ascending: boolean | null = null;
    const q: PageableQuery<Row> = {
      order(column, options) {
        orderedBy = column;
        ascending = options.ascending;
        return q;
      },
      range(from, to) {
        const callIndex = served++;
        calls.push({ orderedBy, ascending, from, to });

        if (opts.failOnCall === callIndex) {
          return Promise.resolve({ data: null, error: { message: "connection reset" } });
        }

        let view: Row[];
        if (orderedBy) {
          view = all
            .slice()
            .sort((a, b) =>
              String(a[orderedBy as keyof Row]).localeCompare(String(b[orderedBy as keyof Row])),
            );
          if (ascending === false) view.reverse();
        } else {
          // No ORDER BY: the server is free to hand back any permutation,
          // and here it does — a different rotation on every single call.
          const shift = ((callIndex + 1) * 137) % all.length;
          view = all.slice(shift).concat(all.slice(0, shift));
        }
        return Promise.resolve({ data: view.slice(from, to + 1), error: null });
      },
    };
    return q;
  };

  return { build, calls };
}

/** The paging loop as it was BEFORE this fix: range only, no ordering. */
async function pageWithoutOrdering(table: ReturnType<typeof fakeTable>, pageSize: number) {
  const out: Row[] = [];
  for (let page = 0; ; page++) {
    const res = await table.build().range(page * pageSize, page * pageSize + pageSize - 1);
    const data = res.data ?? [];
    out.push(...data);
    if (data.length < pageSize) return out;
  }
}

describe("the fixture is genuinely adversarial", () => {
  // If this test ever stops failing to collect every row, the fake has gone
  // soft and the real tests below stop proving anything.
  test("paging the same data WITHOUT an order loses and duplicates rows", async () => {
    const all = rows(2500);
    const table = fakeTable(all);
    const got = await pageWithoutOrdering(table, 1000);

    const seen = new Set(got.map((r) => r.id));
    assert.ok(seen.size < all.length, "expected the unordered walk to miss rows");
    assert.ok(got.length > seen.size, "expected the unordered walk to repeat rows");
  });
});

describe("fetchAllRows applies the ordering itself", () => {
  test("every page is ordered, by the same column, ascending", async () => {
    const table = fakeTable(rows(2500));
    await fetchAllRows(table.build);

    assert.ok(table.calls.length > 1, "expected more than one page");
    for (const call of table.calls) {
      assert.equal(call.orderedBy, "id");
      assert.equal(call.ascending, true);
    }
  });

  test("a caller cannot forget it — there is no unordered path", async () => {
    // The builder never sees from/to, so a call site physically cannot
    // issue its own .range() without the ordering this module adds.
    const table = fakeTable(rows(10));
    await fetchAllRows(table.build);
    assert.equal(table.calls.length, 1);
    assert.equal(table.calls[0].orderedBy, "id");
  });

  test("the ordering column can be overridden", async () => {
    const table = fakeTable(rows(10));
    await fetchAllRows(table.build, { orderBy: "n" });
    assert.equal(table.calls[0].orderedBy, "n");
  });
});

describe("every row comes back exactly once", () => {
  for (const count of [0, 1, 999, 1000, 1001, 2000, 2500, 8000, 8001, 9500]) {
    test(`${count} rows`, async () => {
      const all = rows(count);
      const table = fakeTable(all);
      const { data, error } = await fetchAllRows(table.build);

      assert.equal(error, null);
      assert.equal(data.length, count);
      assert.deepEqual(
        data.map((r) => r.id),
        all.map((r) => r.id),
      );
    });
  }

  test("a dataset larger than one parallel batch still comes back whole", async () => {
    // 8 pages per batch, so 12 pages forces a second batch round.
    const all = rows(11_500);
    const { data, error } = await fetchAllRows(fakeTable(all).build);
    assert.equal(error, null);
    assert.equal(new Set(data.map((r) => r.id)).size, 11_500);
  });

  test("a smaller page size pages more, and still loses nothing", async () => {
    const all = rows(250);
    const table = fakeTable(all);
    const { data } = await fetchAllRows(table.build, { pageSize: 10 });
    assert.equal(data.length, 250);
    assert.equal(new Set(data.map((r) => r.id)).size, 250);
    assert.ok(table.calls.length >= 25);
  });
});

describe("errors", () => {
  test("a failure on the first page is reported with no partial data", async () => {
    const table = fakeTable(rows(5000), { failOnCall: 0 });
    const { data, error } = await fetchAllRows(table.build);
    assert.equal(error, "connection reset");
    assert.deepEqual(data, []);
  });

  test("a failure on a later page is reported rather than silently truncating", async () => {
    // The dangerous outcome would be returning page 1 and calling it the
    // whole dataset — the analysis would then run on a third of the rows.
    const table = fakeTable(rows(5000), { failOnCall: 2 });
    const { error } = await fetchAllRows(table.build);
    assert.equal(error, "connection reset");
  });
});
