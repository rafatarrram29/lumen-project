-- Adds support for multiple linked files per dataset (e.g. Sales +
-- Achievement + KPIs). Run this once in the Supabase SQL Editor, after
-- lumen_user_isolation_migration.sql.
--
-- This is purely additive: it does not touch lumen_datasets or
-- lumen_sales_records in any way. Every dataset's primary sales file keeps
-- working exactly as it does today, through the same column_mapping +
-- lumen_sales_records path. "Linked files" (Achievement, KPIs, or any
-- other file type) are an optional extra layer stored entirely in the two
-- new tables below — a dataset with none of these behaves identically to
-- before this migration.

create table if not exists public.lumen_dataset_files (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.lumen_datasets(id) on delete cascade,
  file_type text not null check (file_type in ('achievement', 'kpis', 'other')),
  display_name text not null,
  source_file text,
  column_mapping jsonb not null,
  join_keys text[] not null,
  created_at timestamptz not null default now()
);

create index if not exists lumen_dataset_files_dataset_idx
  on public.lumen_dataset_files (dataset_id);

-- Generic row storage for linked files: the join-key dimensions get their
-- own typed columns (so they can be matched against lumen_sales_records
-- cheaply), everything else about the row lives in `data` as-is.
create table if not exists public.lumen_dataset_records (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.lumen_datasets(id) on delete cascade,
  file_id uuid not null references public.lumen_dataset_files(id) on delete cascade,
  area text,
  rep text,
  cluster text,
  month integer not null,
  year integer not null,
  data jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz not null default now()
);

create index if not exists lumen_dataset_records_file_idx
  on public.lumen_dataset_records (file_id);
create index if not exists lumen_dataset_records_dataset_year_month_idx
  on public.lumen_dataset_records (dataset_id, year, month);

alter table public.lumen_dataset_files enable row level security;
alter table public.lumen_dataset_records enable row level security;

-- Same ownership-via-dataset pattern as lumen_targets / lumen_sales_records.
drop policy if exists "Users can view dataset files in their own or legacy datasets" on public.lumen_dataset_files;
create policy "Users can view dataset files in their own or legacy datasets"
  on public.lumen_dataset_files for select
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_dataset_files.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can insert dataset files into their own or legacy datasets" on public.lumen_dataset_files;
create policy "Users can insert dataset files into their own or legacy datasets"
  on public.lumen_dataset_files for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_dataset_files.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can update dataset files in their own or legacy datasets" on public.lumen_dataset_files;
create policy "Users can update dataset files in their own or legacy datasets"
  on public.lumen_dataset_files for update
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_dataset_files.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  )
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_dataset_files.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can delete dataset files in their own or legacy datasets" on public.lumen_dataset_files;
create policy "Users can delete dataset files in their own or legacy datasets"
  on public.lumen_dataset_files for delete
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_dataset_files.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can view dataset records in their own or legacy datasets" on public.lumen_dataset_records;
create policy "Users can view dataset records in their own or legacy datasets"
  on public.lumen_dataset_records for select
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_dataset_records.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can insert dataset records into their own or legacy datasets" on public.lumen_dataset_records;
create policy "Users can insert dataset records into their own or legacy datasets"
  on public.lumen_dataset_records for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_dataset_records.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can delete dataset records in their own or legacy datasets" on public.lumen_dataset_records;
create policy "Users can delete dataset records in their own or legacy datasets"
  on public.lumen_dataset_records for delete
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_dataset_records.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );
