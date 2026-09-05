-- Lumen org structure: District Managers above reps.
--
-- Run this once in the Supabase SQL Editor. Purely additive — it creates
-- one table and nothing else, so it is safe on a live project and safe to
-- run twice. Until you assign anyone, the app behaves exactly as it does
-- today.
--
-- WHY A SECOND TABLE, AND NOT A THIRD
--
-- Which areas a rep covers is already recorded, per month, in
-- lumen_rep_assignments. This migration deliberately does NOT duplicate
-- that: the "Assign areas to reps" screen writes rep assignments, the same
-- rows the per-area "+ Add period" control has always written. It is a
-- faster way in, not a second source of truth.
--
-- What genuinely did not exist is the level above: which manager a rep
-- reports to. That is all this table holds.
--
-- SCOPE: per dataset and per year, like rep assignments. A team can be
-- reorganised between years without rewriting last year's history, and the
-- structure travels with the dataset it describes.

create table if not exists public.lumen_district_managers (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.lumen_datasets(id) on delete cascade,
  manager text not null,
  rep text not null,
  year integer not null,
  created_at timestamptz not null default now(),
  -- A rep reports to exactly one manager at a time. Enforced here rather
  -- than in the app: two managers each believing they own the same rep
  -- would double-count that rep's areas in both their team totals, and a
  -- constraint is the only place that cannot be forgotten.
  constraint lumen_district_managers_one_manager_per_rep unique (dataset_id, year, rep)
);

create index if not exists lumen_district_managers_dataset_year_idx
  on public.lumen_district_managers (dataset_id, year);

alter table public.lumen_district_managers enable row level security;

-- Same ownership-via-dataset pattern as lumen_rep_assignments.
drop policy if exists "Users can view managers in their own or legacy datasets" on public.lumen_district_managers;
create policy "Users can view managers in their own or legacy datasets"
  on public.lumen_district_managers for select
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_district_managers.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can insert managers into their own or legacy datasets" on public.lumen_district_managers;
create policy "Users can insert managers into their own or legacy datasets"
  on public.lumen_district_managers for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_district_managers.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can delete managers in their own or legacy datasets" on public.lumen_district_managers;
create policy "Users can delete managers in their own or legacy datasets"
  on public.lumen_district_managers for delete
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_district_managers.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );
