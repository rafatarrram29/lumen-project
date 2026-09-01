-- Follow-up to lumen_ims_migration.sql: makes area and product both
-- optional on lumen_ims_records. A real IMS export is often organized by
-- product/market with no geography column at all (or, less often, by area
-- with no product breakdown) — requiring both was too rigid. At least one
-- of the two is still required at the database level (a market share
-- value has to be attached to SOME named entity), enforced by the check
-- constraint below; the app enforces the same rule when saving a file's
-- column mapping.
--
-- Run this once in the Supabase SQL Editor, after lumen_ims_migration.sql.
-- Purely additive/relaxing — no existing row is touched or invalidated,
-- since every row so far already has both area and product filled in.

alter table public.lumen_ims_records
  alter column area drop not null;

alter table public.lumen_ims_records
  alter column product drop not null;

alter table public.lumen_ims_records
  add constraint lumen_ims_records_area_or_product
  check (area is not null or product is not null);
