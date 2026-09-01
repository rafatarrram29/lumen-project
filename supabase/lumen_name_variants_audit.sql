-- Finds a DIFFERENT class of bug than lumen_data_integrity_audit.sql: not
-- duplicate rows, but the same real-world area/item/rep silently split into
-- two (or more) separate buckets in the report because the raw text differs
-- by whitespace or letter case — e.g. "Domiat 1" vs "Domiat 1 " (a trailing
-- space) or "Domiat 1" vs "DOMIAT 1". The report groups strictly by exact
-- string match, so each variant gets its own row in the dashboard and each
-- one's total looks smaller than the real, combined number — with no error
-- or warning, because nothing is technically wrong with either row.
--
-- This is a plausible root cause for a value that looks too low for one
-- specific area/month: part of that area's real total may be sitting under
-- a near-identical, easy-to-miss variant name elsewhere in the areas list.
--
-- Run this read-only in the Supabase SQL Editor. For every group of rows it
-- shows, look at the `raw_value` column for that dataset — if you see more
-- than one visually-similar spelling of what should be the same
-- area/item/rep, that's the bug. If everything you see is genuinely
-- different names that just happen to share letters, there's nothing to do.

-- AREA variants
with variants as (
  select id, dataset_id, area, lower(trim(area)) as norm
  from public.lumen_sales_records
),
dupes as (
  select dataset_id, norm
  from variants
  group by dataset_id, norm
  having count(distinct area) > 1
)
select
  'area' as column_checked,
  s.dataset_id,
  s.area as raw_value,
  count(*) as row_count,
  sum(s.sales_value) as total_value,
  min(s.month) as min_month,
  max(s.month) as max_month
from public.lumen_sales_records s
join dupes d on d.dataset_id = s.dataset_id and lower(trim(s.area)) = d.norm
group by s.dataset_id, s.area
order by s.dataset_id, lower(trim(s.area)), s.area;

-- ITEM variants (same idea, applied to the item/product name)
with variants as (
  select id, dataset_id, item, lower(trim(item)) as norm
  from public.lumen_sales_records
),
dupes as (
  select dataset_id, norm
  from variants
  group by dataset_id, norm
  having count(distinct item) > 1
)
select
  'item' as column_checked,
  s.dataset_id,
  s.item as raw_value,
  count(*) as row_count,
  sum(s.sales_value) as total_value,
  min(s.month) as min_month,
  max(s.month) as max_month
from public.lumen_sales_records s
join dupes d on d.dataset_id = s.dataset_id and lower(trim(s.item)) = d.norm
group by s.dataset_id, s.item
order by s.dataset_id, lower(trim(s.item)), s.item;

-- REP variants (skips rows with no rep at all)
with variants as (
  select id, dataset_id, rep, lower(trim(rep)) as norm
  from public.lumen_sales_records
  where rep is not null
),
dupes as (
  select dataset_id, norm
  from variants
  group by dataset_id, norm
  having count(distinct rep) > 1
)
select
  'rep' as column_checked,
  s.dataset_id,
  s.rep as raw_value,
  count(*) as row_count,
  sum(s.sales_value) as total_value,
  min(s.month) as min_month,
  max(s.month) as max_month
from public.lumen_sales_records s
join dupes d on d.dataset_id = s.dataset_id and lower(trim(s.rep)) = d.norm
group by s.dataset_id, s.rep
order by s.dataset_id, lower(trim(s.rep)), s.rep;
