-- Adds dataset separation and generic column mapping to Lumen.
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New
-- query), after lumen_schema.sql. Safe to run on a table that already has
-- data — existing rows are backfilled into a "Legacy data" dataset so
-- nothing already uploaded disappears from the app.

-- STEP 1 — the datasets table. Each row is one uploaded file: a name, and
-- the column mapping the app asked about the first time that format was
-- uploaded (so the same format never has to be re-mapped by hand).
create table if not exists public.lumen_datasets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  column_mapping jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.lumen_datasets enable row level security;

drop policy if exists "Authenticated users can view lumen datasets" on public.lumen_datasets;
create policy "Authenticated users can view lumen datasets"
  on public.lumen_datasets for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert lumen datasets" on public.lumen_datasets;
create policy "Authenticated users can insert lumen datasets"
  on public.lumen_datasets for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can delete lumen datasets" on public.lumen_datasets;
create policy "Authenticated users can delete lumen datasets"
  on public.lumen_datasets for delete
  to authenticated
  using (true);

-- STEP 2 — new optional columns on the sales table: which dataset a row
-- belongs to, plus the two optional generic fields (Rep, Cluster) that a
-- dataset's column mapping may or may not use.
alter table public.lumen_sales_records
  add column if not exists dataset_id uuid references public.lumen_datasets(id) on delete cascade;

alter table public.lumen_sales_records
  add column if not exists rep text;

alter table public.lumen_sales_records
  add column if not exists cluster text;

create index if not exists lumen_sales_records_dataset_idx
  on public.lumen_sales_records (dataset_id);

-- STEP 3 — backfill: every row uploaded before this migration has no
-- dataset yet. Create one "Legacy data" dataset with the mapping the app
-- always used before datasets existed, and attach every orphaned row to
-- it, so old data stays visible (picked from the dataset switcher) instead
-- of silently disappearing once dataset_id becomes required.
do $$
declare
  legacy_id uuid;
begin
  if exists (select 1 from public.lumen_sales_records where dataset_id is null) then
    insert into public.lumen_datasets (name, column_mapping)
    values (
      'Legacy data',
      '{"area":"Area","item":"Item","value":"Sales Value","qty":"Sales Qty","month":"Month","rep":null,"cluster":null}'::jsonb
    )
    returning id into legacy_id;

    update public.lumen_sales_records
    set dataset_id = legacy_id
    where dataset_id is null;
  end if;
end $$;

-- STEP 4 — now that every row has a dataset, make it required going
-- forward so new rows can't be uploaded without one.
alter table public.lumen_sales_records
  alter column dataset_id set not null;
