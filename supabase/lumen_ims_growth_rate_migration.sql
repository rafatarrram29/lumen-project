-- Follow-up to lumen_ims_migration.sql / lumen_ims_flexible_mapping_migration.sql.
-- Adds an optional growth_rate column to lumen_ims_records.
--
-- A real IMS PDF's own comparison tables usually carry an explicit growth
-- rate per row (e.g. "GR", "GR R26/R25") alongside the market-share
-- percentage — a genuinely different number (rate of change in the
-- underlying volume) from the share value itself, and one the app had no
-- place to keep. Without it, the Market Insights dashboard's "growth"
-- figures could only ever be approximated from share-point changes across
-- two imported months, which most single-snapshot PDF imports don't have.
-- Capturing the real column when the source file has one lets those
-- figures come from actual extracted data instead of "not available".
--
-- Run this once in the Supabase SQL Editor. Purely additive — no existing
-- row is touched; growth_rate is nullable and simply stays null for every
-- row imported before this migration or from a file with no such column.

alter table public.lumen_ims_records
  add column if not exists growth_rate numeric;
