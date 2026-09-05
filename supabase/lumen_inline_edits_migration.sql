-- Adds direct inline editing of individual data values, with full edit
-- history. Run this once in the Supabase SQL Editor, after
-- lumen_linked_files_migration.sql.
--
-- Purely additive: new nullable/defaulted columns on the two existing raw
-- data tables (used only to visually flag a row as manually edited), the
-- one missing UPDATE policy each table needed, and one new history table.
-- No existing row, query, or dataset is affected until someone actually
-- edits a value.

-- STEP 1 — mark rows that were manually edited (vs. coming straight from
-- an uploaded file), on both raw-data tables.
alter table public.lumen_sales_records
  add column if not exists is_edited boolean not null default false;
alter table public.lumen_sales_records
  add column if not exists edited_at timestamptz;
alter table public.lumen_sales_records
  add column if not exists edited_by text;

alter table public.lumen_dataset_records
  add column if not exists is_edited boolean not null default false;
alter table public.lumen_dataset_records
  add column if not exists edited_at timestamptz;
alter table public.lumen_dataset_records
  add column if not exists edited_by text;

-- STEP 2 — lumen_sales_records has select/insert/delete policies already
-- (the ownership-scoped delete one comes from
-- lumen_user_isolation_migration.sql, re-asserted by
-- lumen_security_hardening_migration.sql), but no UPDATE policy, so inline
-- edits would silently fail under RLS.
drop policy if exists "Users can update rows in their own or legacy datasets" on public.lumen_sales_records;
create policy "Users can update rows in their own or legacy datasets"
  on public.lumen_sales_records for update
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_sales_records.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  )
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_sales_records.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

-- lumen_dataset_records only had select/insert/delete from the linked-files
-- migration — same missing-UPDATE-policy gap, same fix.
drop policy if exists "Users can update dataset records in their own or legacy datasets" on public.lumen_dataset_records;
create policy "Users can update dataset records in their own or legacy datasets"
  on public.lumen_dataset_records for update
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_dataset_records.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  )
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_dataset_records.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

-- STEP 3 — full edit history: who changed what, from what, to what, when.
-- A structured sibling to lumen_corrections (which stays free-text for
-- "flag issue" reports) since an edit always has the same shape.
create table if not exists public.lumen_data_edits (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.lumen_datasets(id) on delete cascade,
  target_label text not null,
  old_value text not null,
  new_value text not null,
  edited_by text,
  created_at timestamptz not null default now()
);

create index if not exists lumen_data_edits_dataset_idx
  on public.lumen_data_edits (dataset_id, created_at desc);

alter table public.lumen_data_edits enable row level security;

drop policy if exists "Users can view edits in their own or legacy datasets" on public.lumen_data_edits;
create policy "Users can view edits in their own or legacy datasets"
  on public.lumen_data_edits for select
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_data_edits.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can insert edits into their own or legacy datasets" on public.lumen_data_edits;
create policy "Users can insert edits into their own or legacy datasets"
  on public.lumen_data_edits for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_data_edits.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );
