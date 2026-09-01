// Supabase's PostgREST layer caps an unranged .select() at a project-level
// "Max Rows" setting (1000 by default) — silently, with no error. A dataset
// with more rows than that limit would come back truncated, which showed up
// as areas or months disappearing from the analysis for no visible reason.
// This pages through with .range() until every row is read, regardless of
// table size or the project's max-rows setting.
//
// Pages are fetched in parallel rather than one-at-a-time: for a dataset
// spanning N pages, awaiting each page before requesting the next means
// total latency is N times one round trip to Supabase — for a several-
// thousand-row dataset (a handful of pages) that alone was a real,
// measurable chunk of the multi-second delay loading /lumen. Firing every
// page's request at once instead means total latency is close to a single
// round trip regardless of row count.
export async function fetchAllRows<T>(
  queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<{ data: T[]; error: string | null }> {
  // First page tells us whether there's more to fetch at all — most
  // datasets fit in one page, so this is the common case and costs
  // nothing extra over the old sequential version.
  const first = await queryPage(0, pageSize - 1);
  if (first.error) return { data: [], error: first.error.message };
  const firstData = first.data ?? [];
  if (firstData.length < pageSize) {
    return { data: firstData, error: null };
  }

  // There's at least a second page. We don't know the exact row count
  // upfront, so speculatively fire off a bounded batch of further pages in
  // parallel; if the last one in a batch still comes back full, there may
  // be more, so fetch another batch the same way.
  const PARALLEL_BATCH = 8;
  const all = [...firstData];
  let nextPage = 1;
  let keepGoing = true;

  while (keepGoing) {
    const pages = Array.from({ length: PARALLEL_BATCH }, (_, i) => nextPage + i);
    const results = await Promise.all(
      pages.map((p) => queryPage(p * pageSize, p * pageSize + pageSize - 1)),
    );

    for (const r of results) {
      if (r.error) return { data: all, error: r.error.message };
    }

    keepGoing = false;
    for (const r of results) {
      const data = r.data ?? [];
      if (data.length === 0) {
        keepGoing = false;
        break;
      }
      all.push(...data);
      if (data.length === pageSize) {
        keepGoing = true;
      } else {
        keepGoing = false;
        break;
      }
    }
    nextPage += PARALLEL_BATCH;
  }

  return { data: all, error: null };
}
