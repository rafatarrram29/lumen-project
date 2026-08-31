-- Adds per-user data isolation to Lumen. Run this once in the Supabase SQL
-- Editor, after lumen_datasets_migration.sql.
--
-- Every dataset now belongs to the user who created it, and everyone's
-- datasets and uploaded rows are private to them by default — another
-- signed-in user can no longer see, add to, or delete your data.
--
-- The one exception is any dataset created BEFORE this migration (its
-- user_id is NULL, since there's no record of who uploaded it — e.g. the
-- "Legacy data" dataset from lumen_datasets_migration.sql's backfill).
-- Those stay visible and usable by every signed-in user exactly as they
-- were before, but can no longer be deleted through the app — delete them
-- manually here in the SQL Editor if you ever want to.

-- STEP 1 — add the ownership column. New rows default to the inserting
-- user automatically; the app also sets this explicitly on insert.
alter table public.lumen_datasets
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.lumen_datasets
  alter column user_id set default auth.uid();

create index if not exists lumen_datasets_user_idx
  on public.lumen_datasets (user_id);

-- STEP 2 — replace the old "any signed-in user can do anything" policies
-- on lumen_datasets with ownership-aware ones.
drop policy if exists "Authenticated users can view lumen datasets" on public.lumen_datasets;
create policy "Users can view their own or legacy datasets"
  on public.lumen_datasets for select
  to authenticated
  using (user_id = auth.uid() or user_id is null);

drop policy if exists "Authenticated users can insert lumen datasets" on public.lumen_datasets;
create policy "Users can insert their own datasets"
  on public.lumen_datasets for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Authenticated users can delete lumen datasets" on public.lumen_datasets;
create policy "Users can delete their own datasets"
  on public.lumen_datasets for delete
  to authenticated
  using (user_id = auth.uid());

-- STEP 3 — do the same for the sales rows. lumen_sales_records has no
-- user_id of its own; ownership always flows from the dataset a row
-- belongs to (via dataset_id), so these policies check through that.
drop policy if exists "Authenticated users can view lumen sales records" on public.lumen_sales_records;
create policy "Users can view rows in their own or legacy datasets"
  on public.lumen_sales_records for select
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_sales_records.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Authenticated users can insert lumen sales records" on public.lumen_sales_records;
create policy "Users can insert rows into their own or legacy datasets"
  on public.lumen_sales_records for insert
  to authenticated
  with check (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_sales_records.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

drop policy if exists "Authenticated users can delete lumen sales records" on public.lumen_sales_records;
create policy "Users can delete rows in their own or legacy datasets"
  on public.lumen_sales_records for delete
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_sales_records.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );
