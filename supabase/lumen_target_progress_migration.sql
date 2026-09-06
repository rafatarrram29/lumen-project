-- Target vs Achievement, per rep and per district manager.
--
-- Run this once in the Supabase SQL Editor, after
-- lumen_targets_migration.sql (and after lumen_rename_cascade_migration.sql,
-- which is where lumen_targets got its UPDATE policy).
--
-- Purely additive: every column below is nullable or defaulted, so targets
-- already uploaded keep working exactly as they do today. The four RLS
-- policies on lumen_targets already cover select/insert/update/delete
-- through the owning dataset, and nothing here changes them.

-- The achievement percentage as it appeared in the uploaded file, when the
-- file carried one. Kept ALONGSIDE the value Lumen computes rather than
-- instead of it: a plan file whose own Ach% disagrees with sales / target
-- is worth knowing about, and silently preferring either number would hide
-- that.
alter table public.lumen_targets
  add column if not exists ach_pct numeric;

-- Typed in by hand from an area or rep card, rather than read from a file.
-- Shown differently in the UI, and — unlike an uploaded row — never
-- cleared by a later upload for the same scope, so a correction someone
-- made deliberately is not undone by re-uploading the plan.
alter table public.lumen_targets
  add column if not exists is_manual boolean not null default false;

-- Which file a row came from, and who last touched it by hand. Same shape
-- as the columns lumen_sales_records already carries, so the Correction
-- log reads the same way for both.
alter table public.lumen_targets
  add column if not exists source_file text;
alter table public.lumen_targets
  add column if not exists edited_by text;
alter table public.lumen_targets
  add column if not exists edited_at timestamptz;

-- A target uploaded from inside one rep's card replaces only that rep's
-- rows, so the scoped delete needs to be cheap: without this it is a
-- sequential scan of every target in the dataset on each upload.
create index if not exists lumen_targets_dataset_year_rep_idx
  on public.lumen_targets (dataset_id, year, rep);
create index if not exists lumen_targets_dataset_year_area_idx
  on public.lumen_targets (dataset_id, year, area);

-- A manual edit addresses exactly one cell — one scope, one item, one
-- month — so it has to find the row it is replacing. Partial, because
-- uploaded rows legitimately repeat a combination (the same item and month
-- can appear once per area inside one rep's plan) and must not be
-- constrained.
create unique index if not exists lumen_targets_manual_cell_idx
  on public.lumen_targets (
    dataset_id, year, month,
    coalesce(rep, ''), coalesce(area, ''), coalesce(item, '')
  )
  where is_manual;
