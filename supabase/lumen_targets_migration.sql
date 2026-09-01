-- Adds Target vs Actual support to Lumen. Run this once in the Supabase
-- SQL Editor, after lumen_user_isolation_migration.sql.
--
-- Targets are uploaded as a separate file per dataset (Area/Rep/Item +
-- Month + Target value, mapped the same way the sales file is). Uploading
-- a new targets file replaces every existing target row for that
-- dataset+year — it's meant to hold the current plan, not a history of
-- edits.

alter table public.lumen_datasets
  add column if not exists target_column_mapping jsonb;

-- lumen_datasets never had an UPDATE policy (only select/insert/delete),
-- so saving a targets mapping onto an existing dataset needs one. Scoped
-- the same way delete already is: only a dataset you own, never a legacy
-- (user_id is null) one shared by everyone.
drop policy if exists "Users can update their own datasets" on public.lumen_datasets;
create policy "Users can update their own datasets"
  on public.lumen_datasets for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.lumen_targets (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.lumen_datasets(id) on delete cascade,
  area text,
  rep text,
  item text,
  month integer not null,
  year integer not null,
  target_value numeric not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists lumen_targets_dataset_year_month_idx
  on public.lumen_targets (dataset_id, year, month);

alter table public.lumen_targets enable row level security;

-- Same ownership-via-dataset pattern as lumen_sales_records (see
-- lumen_user_isolation_migration.sql): a target row is visible/writable
-- only through a dataset the caller owns, or a legacy (user_id is null)
-- dataset shared by everyone.
drop policy if exists "Users can view targets in their own or legacy datasets" on public.lumen_targets;
create policy "Users can view targets in their own or legacy datasets"
  on public.lumen_targets for select
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_targets.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can insert targets into their own or legacy datasets" on public.lumen_targets;
create policy "Users can insert targets into their own or legacy datasets"
  on public.lumen_targets for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_targets.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can delete targets in their own or legacy datasets" on public.lumen_targets;
create policy "Users can delete targets in their own or legacy datasets"
  on public.lumen_targets for delete
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_targets.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );
