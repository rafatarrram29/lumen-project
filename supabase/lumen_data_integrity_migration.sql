-- Prevents byte-identical duplicate rows in lumen_sales_records and
-- lumen_dataset_records at the database level. Run this once in the
-- Supabase SQL Editor, after lumen_undo_migration.sql.
--
-- IMPORTANT — this is a corrected version. An earlier copy of this
-- migration made the unique key just (dataset_id, year, month, area,
-- item, rep) — WITHOUT the measured value. That's wrong for any dataset
-- whose source file has finer granularity than "one row per area/item/
-- month" (e.g. one row per invoice, per branch, per day) — many real
-- datasets legitimately have several distinct rows sharing the same
-- area/item/month/rep with different sales_value each, and the report
-- already correctly sums them. The old version would have rejected that
-- entirely legitimate data as a "duplicate" on the next upload. Real
-- production data surfaced this during testing before the old version
-- was ever run, so no data was lost — but if you copied the old
-- definition into your own SQL Editor already, don't run it; run this
-- one instead.
--
-- This version's key includes sales_value and sales_qty, so it only
-- blocks a row that is a genuine full duplicate — identical in every
-- column, not just identical in area/item/month/rep. That's exactly the
-- shape of a real duplication bug (the same row inserted twice by a
-- retried upload, a double-submit, etc.) and never blocks legitimate
-- distinct rows that happen to share an area/item/month, no matter how
-- many of them there are.
--
-- rep and sales_qty are nullable — a plain UNIQUE constraint treats
-- every null as distinct from every other null under standard SQL
-- semantics, so it would silently fail to catch duplicates in exactly
-- the common case (most datasets have no Rep column, and not every file
-- has a Quantity column). coalesce(...) in the expression index closes
-- that gap.

create unique index if not exists lumen_sales_records_exact_row_idx
  on public.lumen_sales_records (
    dataset_id, year, month, area, item, coalesce(rep, ''), sales_value, coalesce(sales_qty, -1)
  );

create unique index if not exists lumen_dataset_records_exact_row_idx
  on public.lumen_dataset_records (
    file_id, year, month, coalesce(area, ''), coalesce(rep, ''), coalesce(cluster, ''), data
  );
