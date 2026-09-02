// Finds rows inside a single incoming batch that share the same key
// (whatever keyFn extracts — see each caller for exactly which columns
// that is) before we ever attempt to insert them.
//
// Callers must key on a FULL exact-duplicate identity — every stored
// column, including the measured value(s), not just the "which
// area/item/month is this" columns. A source file can legitimately have
// several distinct rows sharing the same area/item/month (one row per
// invoice or per branch, say), all correctly summed by the report; only
// a row that's identical in every column to another is an actual
// duplicate. An earlier version of this keyed on identity columns alone
// and would have rejected that entirely normal multi-row data as
// duplicates — this is what actually caused a real production
// duplication *investigation* to nearly ship a fix that broke legitimate
// uploads instead of just the genuine "a whole row got inserted twice"
// bug (a retried upload, a double-submit) it was meant to catch.
export function findDuplicateKeys<T>(items: T[], keyFn: (item: T) => string): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));
}

// An exact repeat of a row within the SAME upload attempt (e.g. a source
// file that accidentally has the same line twice) is a data-entry accident
// in the file, not a decision the uploader needs to make — silently keep
// the first occurrence and drop the rest, rather than rejecting the whole
// upload and forcing a manual choice. This is a fundamentally different
// case from a NEW upload colliding with rows already committed from a
// PREVIOUS upload (a real "did you mean to replace this month" question,
// still handled by the overlap/replace prompt and the database's own
// uniqueness constraint) — this function only ever looks within the one
// batch of rows it's given.
export function dedupeExactDuplicates<T>(
  items: T[],
  keyFn: (item: T) => string,
  describe: (item: T) => string,
): { kept: T[]; removed: { count: number; examples: string[] } } {
  const seen = new Set<string>();
  const kept: T[] = [];
  const examples: string[] = [];
  let count = 0;
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      count++;
      if (examples.length < 5) examples.push(describe(item));
      continue;
    }
    seen.add(key);
    kept.push(item);
  }
  return { kept, removed: { count, examples } };
}

// Postgres's unique-violation error code — used to recognize a
// duplicate rejected by the database itself (e.g. one that collides with
// a row from an earlier, already-committed batch) and turn it into a
// clear message instead of a raw SQL error.
export const POSTGRES_UNIQUE_VIOLATION = "23505";
