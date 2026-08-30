-- Lumen Territory Decision Engine — isolated migration.
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- This does NOT touch the existing `datasets` / `queries` tables or their
-- policies — it only adds a new table for the /lumen feature.

create table if not exists public.lumen_sales_records (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  item text not null,
  family text not null,
  sales_qty numeric,
  sales_value numeric not null,
  month integer not null,
  year integer not null,
  uploaded_at timestamptz not null default now(),
  source_file text
);

create index if not exists lumen_sales_records_year_month_idx
  on public.lumen_sales_records (year, month);
create index if not exists lumen_sales_records_area_idx
  on public.lumen_sales_records (area);
create index if not exists lumen_sales_records_family_idx
  on public.lumen_sales_records (family);

-- This table has no per-user ownership (it's shared territory data, same as
-- the original SQLite prototype), so RLS just gates access to signed-in
-- users rather than filtering by owner.
alter table public.lumen_sales_records enable row level security;

create policy "Authenticated users can view lumen sales records"
  on public.lumen_sales_records for select
  to authenticated
  using (true);

create policy "Authenticated users can insert lumen sales records"
  on public.lumen_sales_records for insert
  to authenticated
  with check (true);

create policy "Authenticated users can delete lumen sales records"
  on public.lumen_sales_records for delete
  to authenticated
  using (true);
