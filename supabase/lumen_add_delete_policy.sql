-- Adds the missing DELETE policy for lumen_sales_records.
-- Run this once in the Supabase SQL Editor. Needed for the new
-- replace-on-reupload protection (/api/lumen/replace-months) to work —
-- without it, RLS silently blocks every delete.

create policy "Authenticated users can delete lumen sales records"
  on public.lumen_sales_records for delete
  to authenticated
  using (true);
