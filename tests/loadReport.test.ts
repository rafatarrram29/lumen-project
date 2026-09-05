// The single load path behind both the server-rendered first paint and
// /api/lumen/analyze. It exists because those were two copies that had
// already drifted: only the API one selected the edit columns, so a fresh
// page load showed none of the manually corrected figures as corrected.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadReport, latestYearWithData, collectEditedCells } from "../src/lib/lumen/loadReport.ts";

type AnyRow = Record<string, unknown>;

/**
 * A fake Supabase client recording what was asked of it. Cast in at the
 * call site because loadReport takes the real client type — the point of
 * that type is to catch a drift in the query chain at compile time, which
 * a structurally-typed fake would defeat.
 */
/** Applies an ORDER BY the way the real database would. */
function sorted(rows: AnyRow[], ordering: { column: string; ascending: boolean } | null) {
  if (!ordering) return rows;
  const { column, ascending } = ordering;
  return rows.slice().sort((a, b) => {
    const cmp = String(a[column]).localeCompare(String(b[column]), undefined, { numeric: true });
    return ascending ? cmp : -cmp;
  });
}

function fakeSupabase(
  tables: Record<string, AnyRow[]>,
  opts: { failTable?: string; rpc?: AnyRow[]; rpcError?: string } = {},
) {
  const queries: { table: string; columns: string; filters: Record<string, unknown> }[] = [];
  const rpcCalls: { fn: string; args: AnyRow }[] = [];

  const client = {
    // The database-side aggregate. Absent `opts.rpc`/`opts.rpcError` it
    // behaves like a project where the migration has not been run.
    rpc(fn: string, args: AnyRow) {
      rpcCalls.push({ fn, args });
      let ordering: { column: string; ascending: boolean } | null = null;
      const builder = {
        order(column: string, options: { ascending: boolean }) {
          ordering = { column, ascending: options.ascending };
          return builder;
        },
        range(from: number, to: number) {
          const message =
            opts.rpcError ??
            (opts.rpc ? null : `Could not find the function public.${fn} in the schema cache`);
          if (message) return Promise.resolve({ data: null, error: { message } });
          return Promise.resolve({ data: sorted(opts.rpc ?? [], ordering).slice(from, to + 1), error: null });
        },
      };
      return builder;
    },
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let columns = "";
      let ordering: { column: string; ascending: boolean } | null = null;
      const builder = {
        select(cols: string) {
          columns = cols;
          queries.push({ table, columns, filters });
          return builder;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        order(column: string, options: { ascending: boolean }) {
          ordering = { column, ascending: options.ascending };
          return builder;
        },
        limit(n: number) {
          if (opts.failTable === table) {
            return Promise.resolve({ data: null, error: { message: `${table} is down` } });
          }
          // Honours ORDER BY, so a query that sorts the wrong way round
          // gets the wrong row back — exactly as it would in Postgres.
          return Promise.resolve({ data: sorted(tables[table] ?? [], ordering).slice(0, n), error: null });
        },
        range(from: number, to: number) {
          if (opts.failTable === table) {
            return Promise.resolve({ data: null, error: { message: `${table} is down` } });
          }
          return Promise.resolve({ data: sorted(tables[table] ?? [], ordering).slice(from, to + 1), error: null });
        },
      };
      return builder;
    },
  };

  return { client, queries, rpcCalls };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (c: unknown) => c as any;

const salesRow = (o: Partial<AnyRow> & { area: string; family: string; month: number; sales_value: number }) => ({
  sales_qty: null,
  line: null,
  rep: null,
  is_edited: false,
  edited_at: null,
  edited_by: null,
  ...o,
});

describe("collectEditedCells", () => {
  test("rows that were never edited produce nothing", () => {
    const cells = collectEditedCells([
      salesRow({ area: "A", family: "X", month: 1, sales_value: 100 }),
      salesRow({ area: "A", family: "X", month: 2, sales_value: 100 }),
    ]);
    assert.deepEqual(cells, []);
  });

  test("the key is exactly what the dashboard looks a cell up by", () => {
    // The UI does editedCells.get(JSON.stringify([area, fam, month])).
    // If this format drifts, every edit marker silently stops appearing.
    const cells = collectEditedCells([
      salesRow({
        area: "Kafr El Sheikh 1",
        family: "Item A",
        month: 7,
        sales_value: 100,
        is_edited: true,
        edited_at: "2026-01-01T00:00:00.000Z",
        edited_by: "sara@example.com",
      }),
    ]);
    assert.equal(cells.length, 1);
    assert.equal(cells[0].key, JSON.stringify(["Kafr El Sheikh 1", "Item A", 7]));
    assert.equal(cells[0].editedBy, "sara@example.com");
  });

  test("a month arriving as a string still keys as a number", () => {
    // Postgres numerics can come back as strings through PostgREST; a "7"
    // in the key would never match the UI's 7.
    const cells = collectEditedCells([
      salesRow({ area: "A", family: "X", month: "7" as unknown as number, sales_value: 100, is_edited: true }),
    ]);
    assert.equal(cells[0].key, JSON.stringify(["A", "X", 7]));
  });

  test("several rows behind one cell resolve to the most recent edit", () => {
    const cells = collectEditedCells([
      salesRow({
        area: "A", family: "X", month: 1, sales_value: 50,
        is_edited: true, edited_at: "2026-01-01T00:00:00.000Z", edited_by: "older@example.com",
      }),
      salesRow({
        area: "A", family: "X", month: 1, sales_value: 60,
        is_edited: true, edited_at: "2026-03-01T00:00:00.000Z", edited_by: "newer@example.com",
      }),
      salesRow({
        area: "A", family: "X", month: 1, sales_value: 70,
        is_edited: true, edited_at: "2026-02-01T00:00:00.000Z", edited_by: "middle@example.com",
      }),
    ]);
    assert.equal(cells.length, 1);
    assert.equal(cells[0].editedBy, "newer@example.com");
  });

  test("an edited row with no timestamp never beats one that has a real one", () => {
    const cells = collectEditedCells([
      salesRow({ area: "A", family: "X", month: 1, sales_value: 50, is_edited: true, edited_at: null, edited_by: "unknown" }),
      salesRow({
        area: "A", family: "X", month: 1, sales_value: 60,
        is_edited: true, edited_at: "2020-01-01T00:00:00.000Z", edited_by: "known",
      }),
    ]);
    assert.equal(cells[0].editedBy, "known");
  });

  test("the output is ordered, so identical data serialises identically", () => {
    const rows = [
      salesRow({ area: "Zed", family: "X", month: 1, sales_value: 1, is_edited: true, edited_at: "2026-01-01T00:00:00.000Z" }),
      salesRow({ area: "Alpha", family: "Y", month: 2, sales_value: 1, is_edited: true, edited_at: "2026-01-01T00:00:00.000Z" }),
      salesRow({ area: "Mid", family: "Z", month: 3, sales_value: 1, is_edited: true, edited_at: "2026-01-01T00:00:00.000Z" }),
    ];
    const forward = collectEditedCells(rows).map((c) => c.key);
    const backward = collectEditedCells(rows.slice().reverse()).map((c) => c.key);
    assert.deepEqual(forward, backward);
    assert.deepEqual(forward, forward.slice().sort((a, b) => a.localeCompare(b)));
  });
});

describe("loadReport", () => {
  const sales = [
    salesRow({ area: "A", family: "X", month: 1, sales_value: 1000 }),
    salesRow({
      area: "A", family: "X", month: 2, sales_value: 700,
      is_edited: true, edited_at: "2026-02-02T00:00:00.000Z", edited_by: "sara@example.com",
    }),
    salesRow({ area: "B", family: "X", month: 1, sales_value: 1000 }),
    salesRow({ area: "B", family: "X", month: 2, sales_value: 700 }),
  ];

  test("returns a report AND the edit markers in one payload", async () => {
    const { client } = fakeSupabase({ lumen_sales_records: sales, lumen_targets: [] });
    const { payload, error } = await loadReport(asClient(client), "ds-1", 2026);

    assert.equal(error, null);
    assert.ok(payload && !("error" in payload));
    assert.equal(payload!.editedCells.length, 1);
    assert.equal(payload!.editedCells[0].key, JSON.stringify(["A", "X", 2]));
  });

  test("it asks for the edit columns — the first paint used to omit them", async () => {
    // This is the exact drift the shared path exists to prevent.
    const { client, queries } = fakeSupabase({ lumen_sales_records: sales, lumen_targets: [] });
    await loadReport(asClient(client), "ds-1", 2026);

    const salesQuery = queries.find((q) => q.table === "lumen_sales_records")!;
    for (const column of ["is_edited", "edited_at", "edited_by"]) {
      assert.ok(salesQuery.columns.includes(column), `missing ${column}`);
    }
  });

  test("both queries are scoped to the dataset and year", async () => {
    const { client, queries } = fakeSupabase({ lumen_sales_records: sales, lumen_targets: [] });
    await loadReport(asClient(client), "ds-42", 2024);

    assert.equal(queries.length, 2);
    for (const q of queries) {
      assert.equal(q.filters.dataset_id, "ds-42");
      assert.equal(q.filters.year, 2024);
    }
  });

  test("targets are passed through to the engine", async () => {
    const { client } = fakeSupabase({
      lumen_sales_records: sales,
      lumen_targets: [{ area: "A", rep: null, item: null, month: 2, target_value: 1000 }],
    });
    const { payload } = await loadReport(asClient(client), "ds-1", 2026);
    assert.ok(payload && !("error" in payload));
    assert.equal((payload as { hasTargets: boolean }).hasTargets, true);
  });

  test("a failed sales read is reported rather than analysed as an empty dataset", async () => {
    // Silently building a report from zero rows would show "no data" for a
    // dataset that is actually full.
    const { client } = fakeSupabase({ lumen_sales_records: sales }, { failTable: "lumen_sales_records" });
    const { payload, error } = await loadReport(asClient(client), "ds-1", 2026);
    assert.equal(payload, null);
    assert.equal(error, "lumen_sales_records is down");
  });
});

describe("latestYearWithData", () => {
  test("opens on the most recent year the dataset actually has", async () => {
    // The rows come back ordered by year descending, so the first is the
    // latest — this is the query, not a scan of everything.
    const { client, queries } = fakeSupabase({ lumen_sales_records: [{ year: 2023 }, { year: 2025 }, { year: 2024 }] });
    assert.equal(await latestYearWithData(asClient(client), "ds-1"), 2025);
    assert.equal(queries[0].filters.dataset_id, "ds-1");
  });

  test("a year arriving as a string is still a year", async () => {
    const { client } = fakeSupabase({ lumen_sales_records: [{ year: "2023" }] });
    assert.equal(await latestYearWithData(asClient(client), "ds-1"), 2023);
  });

  test("an empty dataset opens on the calendar year — the right year to upload into", async () => {
    const { client } = fakeSupabase({ lumen_sales_records: [] });
    assert.equal(await latestYearWithData(asClient(client), "ds-1"), new Date().getFullYear());
  });

  test("a failed lookup falls back rather than throwing on the way to the dashboard", async () => {
    const { client } = fakeSupabase({ lumen_sales_records: [{ year: 2025 }] }, { failTable: "lumen_sales_records" });
    assert.equal(await latestYearWithData(asClient(client), "ds-1"), new Date().getFullYear());
  });

  test("last year's data does not read as 'no data' after New Year", async () => {
    // The concrete failure: on 1 January 2026 a dataset full of 2025 rows
    // showed "No data found for year 2026".
    const { client } = fakeSupabase({ lumen_sales_records: [{ year: 2025 }] });
    const year = await latestYearWithData(asClient(client), "ds-1");
    assert.notEqual(year, new Date().getFullYear() + 1);
    assert.equal(year, 2025);
  });
});

describe("loadReport reads through the database-side aggregate", () => {
  const aggregated = [
    salesRow({ area: "A", family: "X", month: 1, sales_value: 1000 }),
    salesRow({
      area: "A", family: "X", month: 2, sales_value: 700,
      is_edited: true, edited_at: "2026-02-02T00:00:00.000Z", edited_by: "sara@example.com",
    }),
    salesRow({ area: "B", family: "X", month: 1, sales_value: 1000 }),
    salesRow({ area: "B", family: "X", month: 2, sales_value: 700 }),
  ].map((r, i) => ({ ...r, id: i + 1 }));

  test("calls the aggregate with the dataset and year, and never touches the raw table", async () => {
    const { client, queries, rpcCalls } = fakeSupabase({ lumen_targets: [] }, { rpc: aggregated });
    const { payload, error } = await loadReport(asClient(client), "ds-1", 2026);

    assert.equal(error, null);
    assert.deepEqual(rpcCalls[0], {
      fn: "lumen_sales_aggregate",
      args: { p_dataset_id: "ds-1", p_year: 2026 },
    });
    assert.equal(queries.find((q) => q.table === "lumen_sales_records"), undefined);
    assert.ok(payload && !("error" in payload));
    assert.equal((payload as { areas: Record<string, unknown> }).areas.A !== undefined, true);
  });

  test("the edit markers survive the aggregate path", async () => {
    const { client } = fakeSupabase({ lumen_targets: [] }, { rpc: aggregated });
    const { payload } = await loadReport(asClient(client), "ds-1", 2026);
    assert.deepEqual(payload!.editedCells.map((c) => c.key), [JSON.stringify(["A", "X", 2])]);
  });

  test("a project without the migration falls back to the raw rows", async () => {
    // The aggregate is missing, so this must still produce a report — the
    // old path, same output, just slower.
    const { client, queries, rpcCalls } = fakeSupabase({ lumen_sales_records: aggregated, lumen_targets: [] });
    const { payload, error } = await loadReport(asClient(client), "ds-1", 2026);

    assert.equal(error, null);
    assert.equal(rpcCalls.length > 0, true, "should have tried the aggregate first");
    const salesQuery = queries.find((q) => q.table === "lumen_sales_records");
    assert.ok(salesQuery, "did not fall back to the raw table");
    for (const column of ["is_edited", "edited_at", "edited_by"]) {
      assert.ok(salesQuery!.columns.includes(column), `fallback missing ${column}`);
    }
    assert.ok(payload && !("error" in payload));
  });

  test("the fallback produces the same report the aggregate does", async () => {
    const viaAggregate = await loadReport(
      asClient(fakeSupabase({ lumen_targets: [] }, { rpc: aggregated }).client),
      "ds-1",
      2026,
    );
    const viaRaw = await loadReport(
      asClient(fakeSupabase({ lumen_sales_records: aggregated, lumen_targets: [] }).client),
      "ds-1",
      2026,
    );
    assert.deepEqual(viaRaw.payload, viaAggregate.payload);
  });

  test("a broken aggregate degrades to the raw path rather than failing the page", async () => {
    const { client, queries } = fakeSupabase(
      { lumen_sales_records: aggregated, lumen_targets: [] },
      { rpcError: "permission denied for function lumen_sales_aggregate" },
    );
    const { payload, error } = await loadReport(asClient(client), "ds-1", 2026);
    assert.equal(error, null);
    assert.ok(queries.some((q) => q.table === "lumen_sales_records"));
    assert.ok(payload);
  });

  test("if BOTH paths fail, the error is reported rather than shown as an empty dataset", async () => {
    const { client } = fakeSupabase(
      { lumen_sales_records: aggregated, lumen_targets: [] },
      { rpcError: "aggregate is down", failTable: "lumen_sales_records" },
    );
    const { payload, error } = await loadReport(asClient(client), "ds-1", 2026);
    assert.equal(payload, null);
    assert.equal(error, "lumen_sales_records is down");
  });
});
