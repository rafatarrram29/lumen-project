-- Adds rep assignment history to Lumen — a display-only record of which
-- rep (if any) was responsible for an area during which months. Run this
-- once in the Supabase SQL Editor, after lumen_user_isolation_migration.sql.
--
-- This is purely informational: it never feeds into buildReport()'s
-- trend/systemic/root-cause math, which keeps treating each area as one
-- continuous unit regardless of rep handoffs or vacant periods. A null
-- rep on a row means "vacant" for that stretch of months.

create table if not exists public.lumen_rep_assignments (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.lumen_datasets(id) on delete cascade,
  area text not null,
  rep text,
  year integer not null,
  start_month integer not null,
  end_month integer not null,
  created_at timestamptz not null default now(),
  constraint lumen_rep_assignments_month_range check (start_month <= end_month)
);

create index if not exists lumen_rep_assignments_dataset_year_area_idx
  on public.lumen_rep_assignments (dataset_id, year, area);

alter table public.lumen_rep_assignments enable row level security;

-- Same ownership-via-dataset pattern as lumen_sales_records / lumen_targets.
drop policy if exists "Users can view rep assignments in their own or legacy datasets" on public.lumen_rep_assignments;
create policy "Users can view rep assignments in their own or legacy datasets"
  on public.lumen_rep_assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_rep_assignments.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can insert rep assignments into their own or legacy datasets" on public.lumen_rep_assignments;
create policy "Users can insert rep assignments into their own or legacy datasets"
  on public.lumen_rep_assignments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_rep_assignments.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can delete rep assignments in their own or legacy datasets" on public.lumen_rep_assignments;
create policy "Users can delete rep assignments in their own or legacy datasets"
  on public.lumen_rep_assignments for delete
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_rep_assignments.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );
