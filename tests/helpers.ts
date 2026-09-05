import type { SalesRecord, TargetRecord } from "../src/lib/lumen/engine.ts";

/**
 * Build one sales record. Only the fields a test actually cares about need
 * to be given; the optional dimensions default to absent, which is the
 * shape a dataset with no Rep/Line column produces.
 */
export function rec(
  o: {
    area: string;
    family: string;
    month: number;
    salesValue: number;
    salesQty?: number | null;
    line?: string | null;
    rep?: string | null;
  },
): SalesRecord {
  return {
    area: o.area,
    family: o.family,
    month: o.month,
    salesValue: o.salesValue,
    salesQty: o.salesQty ?? null,
    line: o.line ?? null,
    rep: o.rep ?? null,
  };
}

export function target(
  o: {
    month: number;
    targetValue: number;
    area?: string | null;
    rep?: string | null;
    item?: string | null;
  },
): TargetRecord {
  return {
    month: o.month,
    targetValue: o.targetValue,
    area: o.area ?? null,
    rep: o.rep ?? null,
    item: o.item ?? null,
  };
}

/**
 * One row per (area, month) with a single item, for tests that only care
 * about area-level totals. `values` maps an area to its month-by-month
 * totals starting at month 1.
 */
export function areaSeries(
  values: Record<string, number[]>,
  opts: { family?: string; line?: (area: string) => string | null; rep?: (area: string) => string | null } = {},
): SalesRecord[] {
  const out: SalesRecord[] = [];
  for (const [area, months] of Object.entries(values)) {
    months.forEach((v, i) => {
      out.push(
        rec({
          area,
          family: opts.family ?? "ItemA",
          month: i + 1,
          salesValue: v,
          line: opts.line ? opts.line(area) : null,
          rep: opts.rep ? opts.rep(area) : null,
        }),
      );
    });
  }
  return out;
}

/** Narrow a Report to its success shape, failing the test if it errored. */
export function ok<T extends object>(report: T | { error: string }): T {
  if ("error" in report) throw new Error(`expected a report, got error: ${report.error}`);
  return report;
}

/**
 * Deterministic shuffle (seeded LCG) so an order-independence test that
 * fails can be reproduced exactly rather than being flaky.
 */
export function shuffle<T>(items: T[], seed = 12345): T[] {
  const out = items.slice();
  let s = seed;
  const next = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
