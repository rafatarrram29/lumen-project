-- Read-only audit: finds every group of rows in lumen_sales_records that
-- share the same dataset/area/item/month/rep, across ALL datasets, before
-- you touch anything. Run this FIRST — nothing here deletes or changes
-- data.
--
-- IMPORTANT — read this before acting on the results. A group showing up
-- here is NOT automatically a bug. Two very different situations produce
-- the same grouping:
--   1. SAFE_TO_DEDUPE — every row in the group has the exact same
--      sales_value (and sales_qty) as every other row. This is a real
--      duplicate: the same logical row got inserted more than once (a
--      retried upload, a double-submit, an old bug). Safe to clean up —
--      see lumen_dedupe.sql.
--   2. NEEDS_MANUAL_REVIEW — the rows in the group have DIFFERENT
--      values from each other. If you see this on every single group,
--      it almost always means your source file has finer granularity
--      than "one row per area/item/month" — e.g. one row per invoice,
--      per branch, or per day, all legitimately landing on the same
--      area/item/month when the file is mapped. That is NOT a bug: the
--      app already sums every matching row into the area/item/month
--      total shown on the dashboard, so nothing here needs to be
--      deleted. Only dig into an individual group (compare against the
--      original source file) if a specific number on the dashboard
--      looks wrong to you — don't bulk-delete anything in this bucket.

-- STEP 1 — how many groups exist, per dataset, and how many of those are
-- actual exact-duplicate rows (the part worth acting on) vs. groups that
-- just have more than one row with different values (normal for a
-- transaction/invoice-level source file — see above).
select
  d.name as dataset_name,
  s.dataset_id,
  count(*) filter (where s.copies > 1) as multi_row_groups,
  count(*) filter (where s.copies > 1 and s.distinct_values = 1) as exact_duplicate_groups,
  sum(s.copies - 1) filter (where s.copies > 1 and s.distinct_values = 1) as extra_duplicate_rows
from (
  select
    dataset_id, year, month, area, item, coalesce(rep, '') as rep_key,
    count(*) as copies,
    count(distinct (sales_value, coalesce(sales_qty, -1))) as distinct_values
  from public.lumen_sales_records
  group by dataset_id, year, month, area, item, coalesce(rep, '')
) s
join public.lumen_datasets d on d.id = s.dataset_id
group by d.name, s.dataset_id
having count(*) filter (where s.copies > 1) > 0
order by exact_duplicate_groups desc, multi_row_groups desc;

-- STEP 2 — the actual rows for groups with more than one distinct value,
-- so you can eyeball a specific one you're suspicious of. Being in this
-- list is not itself a problem — see the note above.
select
  d.name as dataset_name,
  s.area, s.item, s.month, s.year,
  case when s.rep_key = '' then null else s.rep_key end as rep,
  s.copies,
  case when s.distinct_values = 1 then 'SAFE_TO_DEDUPE' else 'NEEDS_MANUAL_REVIEW' end as status
from (
  select
    dataset_id, year, month, area, item, coalesce(rep, '') as rep_key,
    count(*) as copies,
    count(distinct (sales_value, coalesce(sales_qty, -1))) as distinct_values
  from public.lumen_sales_records
  group by dataset_id, year, month, area, item, coalesce(rep, '')
  having count(*) > 1
) s
join public.lumen_datasets d on d.id = s.dataset_id
order by status desc, dataset_name, s.area, s.month;
