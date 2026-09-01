-- Adds an in-app correction/flagging mechanism to Lumen. Run this once in
-- the Supabase SQL Editor, after lumen_linked_files_migration.sql.
--
-- Purely additive: a new table only, nothing else touched.

create table if not exists public.lumen_corrections (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.lumen_datasets(id) on delete cascade,
  issue_type text not null check (issue_type in ('wrong_number', 'wrong_link', 'bad_decision', 'other')),
  target_label text,
  comment text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists lumen_corrections_dataset_idx
  on public.lumen_corrections (dataset_id, created_at desc);

alter table public.lumen_corrections enable row level security;

drop policy if exists "Users can view corrections in their own or legacy datasets" on public.lumen_corrections;
create policy "Users can view corrections in their own or legacy datasets"
  on public.lumen_corrections for select
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_corrections.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can insert corrections into their own or legacy datasets" on public.lumen_corrections;
create policy "Users can insert corrections into their own or legacy datasets"
  on public.lumen_corrections for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_corrections.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can update corrections in their own or legacy datasets" on public.lumen_corrections;
create policy "Users can update corrections in their own or legacy datasets"
  on public.lumen_corrections for update
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_corrections.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  )
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_corrections.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );
