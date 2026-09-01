// Finds rows inside a single incoming batch that share the same identity
// key (the same columns the database's unique index checks) before we
// ever attempt to insert them — this is what actually caused a real
// production duplication bug: a batch with repeated area/item/month rows
// inserted cleanly (no DB error, since there was no uniqueness
// constraint at all at the time), silently inflating that period's
// totals. Catching it here gives a specific, actionable error instead of
// a generic Postgres constraint-violation message once the DB-level
// safeguard is also in place.
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

// Postgres's unique-violation error code — used to recognize a
// duplicate rejected by the database itself (e.g. one that collides with
// a row from an earlier, already-committed batch) and turn it into a
// clear message instead of a raw SQL error.
export const POSTGRES_UNIQUE_VIOLATION = "23505";
