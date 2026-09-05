-- ⚠️ This file previously created an UNRESTRICTED delete policy:
--
--     create policy "Authenticated users can delete lumen sales records"
--       on public.lumen_sales_records for delete to authenticated
--       using (true);
--
-- That was written before per-user isolation existed, when every signed-in
-- user was meant to share one pool of data. It is now dangerous: RLS
-- policies are OR-ed together, so leaving it in place lets ANY signed-in
-- account delete ANY other user's sales rows, silently overriding the
-- ownership-scoped policy sitting next to it.
--
-- Its original justification ("without it, re-uploading a month fails
-- silently") no longer holds either. The ownership-scoped DELETE policy
-- added by lumen_user_isolation_migration.sql already covers the
-- re-upload path completely — verified by deleting an owner's own rows
-- with only the scoped policy present.
--
-- So this file now does the opposite of what it used to: it REMOVES the
-- open policy and guarantees the scoped one is in place. Running it is
-- safe and idempotent. Superseded by lumen_security_hardening_migration.sql,
-- which does this plus the rest of the hardening — prefer that one.

drop policy if exists "Authenticated users can delete lumen sales records"
  on public.lumen_sales_records;

drop policy if exists "Users can delete rows in their own or legacy datasets"
  on public.lumen_sales_records;
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
