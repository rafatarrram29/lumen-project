-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- Safe to re-run: it drops the old single-file "datasets" model (from the
-- earlier generic-CSV version of this app, not yet in production use) and
-- replaces it with four category tables plus an upload log.
--
-- Access model (v1): any signed-in user can read and write all rows in
-- these tables -- this is one shared team dashboard, not per-user data.
-- Row Level Security is still turned on (required by Supabase best
-- practice, and it blocks anonymous/unauthenticated access), but the
-- policies below do not restrict one signed-in user from another's data.

drop table if exists public.queries cascade;
drop table if exists public.datasets cascade;
drop table if exists public.sales_records cascade;
drop table if exists public.doctor_activity cascade;
drop table if exists public.call_rate cascade;
drop table if exists public.ims_market cascade;
drop table if exists public.uploads cascade;

-- One row per uploaded file: what Claude decided it is, how it mapped the
-- columns, and whether a human confirmed that before it was imported.
create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  category text not null check (category in ('sales', 'doctors', 'call_rate', 'ims_market', 'unknown')),
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  ai_confidence numeric,
  ai_reasoning text,
  column_mapping jsonb not null default '{}'::jsonb,
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Sales by rep / area / item / customer / month.
create table public.sales_records (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.uploads (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  rep text not null default '',
  area text not null,
  item text not null,
  customer text not null,
  period text not null,
  sales_value numeric,
  sales_qty numeric,
  updated_at timestamptz not null default now(),
  unique (rep, area, item, customer, period)
);

-- Doctor activity and expense entries (calls, visits, samples, spend, etc.).
create table public.doctor_activity (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.uploads (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  rep text not null default '',
  doctor_name text not null,
  area text not null,
  period text not null,
  activity_type text not null default 'activity',
  value numeric,
  notes text,
  updated_at timestamptz not null default now(),
  unique (rep, doctor_name, area, period, activity_type)
);

-- Call Rate / coverage by rep, area and month.
create table public.call_rate (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.uploads (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  rep text not null,
  area text not null,
  period text not null,
  calls_planned numeric,
  calls_made numeric,
  coverage_pct numeric,
  updated_at timestamptz not null default now(),
  unique (rep, area, period)
);

-- IMS market share by area / item / month.
create table public.ims_market (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.uploads (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  area text not null,
  item text not null,
  period text not null,
  company_sales numeric,
  market_total numeric,
  market_share_pct numeric,
  updated_at timestamptz not null default now(),
  unique (area, item, period)
);

-- Q&A history for the per-category "ask Claude" chat.
create table public.queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('sales', 'doctors', 'call_rate', 'ims_market')),
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

alter table public.uploads enable row level security;
alter table public.sales_records enable row level security;
alter table public.doctor_activity enable row level security;
alter table public.call_rate enable row level security;
alter table public.ims_market enable row level security;
alter table public.queries enable row level security;

create policy "Signed-in users can read uploads" on public.uploads for select using (auth.role() = 'authenticated');
create policy "Signed-in users can insert uploads" on public.uploads for insert with check (auth.role() = 'authenticated');
create policy "Signed-in users can update uploads" on public.uploads for update using (auth.role() = 'authenticated');

create policy "Signed-in users can read sales_records" on public.sales_records for select using (auth.role() = 'authenticated');
create policy "Signed-in users can write sales_records" on public.sales_records for insert with check (auth.role() = 'authenticated');
create policy "Signed-in users can update sales_records" on public.sales_records for update using (auth.role() = 'authenticated');
create policy "Signed-in users can delete sales_records" on public.sales_records for delete using (auth.role() = 'authenticated');

create policy "Signed-in users can read doctor_activity" on public.doctor_activity for select using (auth.role() = 'authenticated');
create policy "Signed-in users can write doctor_activity" on public.doctor_activity for insert with check (auth.role() = 'authenticated');
create policy "Signed-in users can update doctor_activity" on public.doctor_activity for update using (auth.role() = 'authenticated');
create policy "Signed-in users can delete doctor_activity" on public.doctor_activity for delete using (auth.role() = 'authenticated');

create policy "Signed-in users can read call_rate" on public.call_rate for select using (auth.role() = 'authenticated');
create policy "Signed-in users can write call_rate" on public.call_rate for insert with check (auth.role() = 'authenticated');
create policy "Signed-in users can update call_rate" on public.call_rate for update using (auth.role() = 'authenticated');
create policy "Signed-in users can delete call_rate" on public.call_rate for delete using (auth.role() = 'authenticated');

create policy "Signed-in users can read ims_market" on public.ims_market for select using (auth.role() = 'authenticated');
create policy "Signed-in users can write ims_market" on public.ims_market for insert with check (auth.role() = 'authenticated');
create policy "Signed-in users can update ims_market" on public.ims_market for update using (auth.role() = 'authenticated');
create policy "Signed-in users can delete ims_market" on public.ims_market for delete using (auth.role() = 'authenticated');

create policy "Signed-in users can read queries" on public.queries for select using (auth.role() = 'authenticated');
create policy "Signed-in users can insert queries" on public.queries for insert with check (auth.role() = 'authenticated');

create index uploads_created_at_idx on public.uploads (created_at desc);
create index sales_records_period_idx on public.sales_records (period);
create index doctor_activity_period_idx on public.doctor_activity (period);
create index call_rate_period_idx on public.call_rate (period);
create index ims_market_period_idx on public.ims_market (period);
create index queries_category_idx on public.queries (category);
