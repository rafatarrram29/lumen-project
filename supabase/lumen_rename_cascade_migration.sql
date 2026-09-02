-- Adds UPDATE policies so the item/area/product name-rename feature (see
-- src/app/api/lumen/sales-records/rename and .../ims-files/rename) can
-- cascade beyond lumen_sales_records and lumen_dataset_records — which
-- already had UPDATE policies from lumen_inline_edits_migration.sql — into
-- lumen_targets, lumen_rep_assignments, and lumen_ims_records. Run this
-- once in the Supabase SQL Editor, after lumen_ims_growth_rate_migration.sql.
--
-- Purely additive: no new columns, no existing row touched or invalidated.
-- Without this migration, renaming an item or area still works immediately
-- for the main Sales table and linked files (Achievement/KPIs) — it just
-- won't reach Targets, Rep assignment history, or IMS records until this
-- is run (Postgres RLS quietly matches zero rows for an update with no
-- applicable policy, rather than erroring, so nothing breaks either way).

drop policy if exists "Users can update targets in their own or legacy datasets" on public.lumen_targets;
create policy "Users can update targets in their own or legacy datasets"
  on public.lumen_targets for update
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_targets.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  )
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_targets.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can update rep assignments in their own or legacy datasets" on public.lumen_rep_assignments;
create policy "Users can update rep assignments in their own or legacy datasets"
  on public.lumen_rep_assignments for update
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_rep_assignments.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  )
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_rep_assignments.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Users can update ims records in their own or legacy datasets" on public.lumen_ims_records;
create policy "Users can update ims records in their own or legacy datasets"
  on public.lumen_ims_records for update
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_ims_records.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  )
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_ims_records.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );
