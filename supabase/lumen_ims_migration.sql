-- Adds the IMS / Market Insights section: an optional extra data type per
-- dataset, entirely separate from the sales analysis. Run this once in the
-- Supabase SQL Editor, after lumen_rename_cluster_to_line_migration.sql.
--
-- This is purely additive — it does not touch lumen_datasets,
-- lumen_sales_records, or any linked-file table in any way. A dataset with
-- no IMS file behaves identically to before this migration; the main
-- dashboard's sales analysis never reads these tables.
--
-- Same lesson already applied to lumen_sales_records: the uniqueness rule
-- below includes the measured value (market_share), not just the identity
-- columns — a source file can legitimately have several distinct rows
-- sharing area/product/month/company (e.g. finer time granularity than one
-- row per month), and only a byte-identical row is a real duplicate.

create table if not exists public.lumen_ims_files (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.lumen_datasets(id) on delete cascade,
  display_name text not null,
  source_file text,
  column_mapping jsonb not null,
  -- The exact string found in the mapped "company" column that represents
  -- our own company, vs. everything else being a competitor. Null when the
  -- file has no company column at all (every row is then treated as our
  -- own share).
  own_company text,
  created_at timestamptz not null default now()
);

create index if not exists lumen_ims_files_dataset_idx
  on public.lumen_ims_files (dataset_id);

create table if not exists public.lumen_ims_records (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.lumen_datasets(id) on delete cascade,
  file_id uuid not null references public.lumen_ims_files(id) on delete cascade,
  area text not null,
  product text not null,
  company text,
  market_share numeric not null,
  month integer not null,
  year integer not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists lumen_ims_records_file_idx
  on public.lumen_ims_records (file_id);
create index if not exists lumen_ims_records_dataset_year_month_idx
  on public.lumen_ims_records (dataset_id, year, month);

create unique index if not exists lumen_ims_records_exact_row_idx
  on public.lumen_ims_records (
    dataset_id, year, month, area, product, coalesce(company, ''), market_share
  );

alter table public.lumen_ims_files enable row level security;
alter table public.lumen_ims_records enable row level security;

-- Same ownership-via-dataset pattern as every other lumen_* table.
drop policy if exists "Users can view ims files in their own or legacy datasets" on public.lumen_ims_files;
create policy "Users can view ims files in their own or legacy datasets"
  on public.lumen_ims_files for select
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_ims_files.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can insert ims files into their own or legacy datasets" on public.lumen_ims_files;
create policy "Users can insert ims files into their own or legacy datasets"
  on public.lumen_ims_files for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_ims_files.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can update ims files in their own or legacy datasets" on public.lumen_ims_files;
create policy "Users can update ims files in their own or legacy datasets"
  on public.lumen_ims_files for update
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_ims_files.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  )
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_ims_files.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can delete ims files in their own or legacy datasets" on public.lumen_ims_files;
create policy "Users can delete ims files in their own or legacy datasets"
  on public.lumen_ims_files for delete
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_ims_files.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can view ims records in their own or legacy datasets" on public.lumen_ims_records;
create policy "Users can view ims records in their own or legacy datasets"
  on public.lumen_ims_records for select
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_ims_records.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can insert ims records into their own or legacy datasets" on public.lumen_ims_records;
create policy "Users can insert ims records into their own or legacy datasets"
  on public.lumen_ims_records for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_ims_records.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can delete ims records in their own or legacy datasets" on public.lumen_ims_records;
create policy "Users can delete ims records in their own or legacy datasets"
  on public.lumen_ims_records for delete
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_ims_records.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );
