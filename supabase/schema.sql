-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- Sets up per-user data storage with Row Level Security so a user can only
-- ever read or write their own rows.

create table if not exists public.datasets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  columns jsonb not null,
  rows jsonb not null,
  row_count integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

alter table public.datasets enable row level security;
alter table public.queries enable row level security;

create policy "Users can view own datasets"
  on public.datasets for select
  using (auth.uid() = user_id);

create policy "Users can insert own datasets"
  on public.datasets for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own datasets"
  on public.datasets for delete
  using (auth.uid() = user_id);

create policy "Users can view own queries"
  on public.queries for select
  using (auth.uid() = user_id);

create policy "Users can insert own queries"
  on public.queries for insert
  with check (auth.uid() = user_id);

create index if not exists datasets_user_id_idx on public.datasets (user_id);
create index if not exists queries_dataset_id_idx on public.queries (dataset_id);
