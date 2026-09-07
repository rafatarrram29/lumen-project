-- A combined Sales-vs-Target export carries its own actual-sales figures
-- (Sales Val, Sales Qty) alongside the plan (FCT Val) and its own Ach %,
-- rather than expecting Lumen to match the row up against the separately
-- uploaded Sales file. Run this once in the Supabase SQL Editor, after
-- lumen_target_progress_migration.sql.
--
-- Purely additive: both columns are nullable, so a target already uploaded
-- without this mapping keeps working exactly as it does today — Lumen
-- falls back to matching it against lumen_sales_records, same as before
-- this migration existed.

alter table public.lumen_targets
  add column if not exists sales_value numeric;

alter table public.lumen_targets
  add column if not exists sales_qty numeric;
