// Supabase's PostgREST layer caps an unranged .select() at a project-level
// "Max Rows" setting (1000 by default) — silently, with no error. A dataset
// with more rows than that limit would come back truncated, which showed up
// as areas or months disappearing from the analysis for no visible reason.
// This pages through with .range() until a page comes back short, so every
// row is read regardless of table size or the project's max-rows setting.
export async function fetchAllRows<T>(
  queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<{ data: T[]; error: string | null }> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await queryPage(from, from + pageSize - 1);
    if (error) return { data: all, error: error.message };
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return { data: all, error: null };
}
