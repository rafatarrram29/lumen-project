-- Prevents duplicate rows in lumen_sales_records and lumen_dataset_records
-- at the database level, so a duplicate can never be silently written no
-- matter what path (upload, replace, or a future feature) produced it.
-- Run this once in the Supabase SQL Editor, after
-- lumen_undo_migration.sql.
--
-- Background: neither table had any uniqueness guarantee on the columns
-- that identify "one real row" (which area/item/month/rep a sales row is
-- for, or which file/area/month a linked row is for) — only sales_value
-- and the other measured columns varied per row, nothing enforced that
-- the *identity* columns couldn't repeat. A partial upload retry, a
-- network double-send, or any other path that re-inserts the same
-- logical row silently doubled (or worse) that area's numbers with no
-- error and no trace, which is what actually happened to affect real
-- data. See also lumen_data_integrity_audit.sql (find existing damage)
-- and the corrected lumen_dedupe.sql (clean it up) — this migration only
-- stops new duplicates from being written; it does not touch existing
-- rows.
--
-- rep is nullable and most datasets have no Rep column at all (every row
-- rep = null) — a plain UNIQUE constraint would treat every null as
-- distinct from every other null under standard SQL semantics, so it
-- would silently fail to catch duplicates in exactly the common case.
-- coalesce(rep, '') in an expression index closes that gap.

create unique index if not exists lumen_sales_records_identity_idx
  on public.lumen_sales_records (dataset_id, year, month, area, item, coalesce(rep, ''));

create unique index if not exists lumen_dataset_records_identity_idx
  on public.lumen_dataset_records (file_id, year, month, coalesce(area, ''), coalesce(rep, ''), coalesce(cluster, ''));
