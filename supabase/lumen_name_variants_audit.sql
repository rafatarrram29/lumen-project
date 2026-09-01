-- Finds a DIFFERENT class of bug than lumen_data_integrity_audit.sql: not
-- duplicate rows, but the same real-world area/item/rep/cluster silently
-- split into two (or more) separate buckets in the report because the raw
-- text differs by whitespace or letter case — e.g. "Domiat 1" vs "Domiat 1 "
-- (a trailing space) or "Domiat 1" vs "DOMIAT 1". The report groups
-- strictly by exact string match, so each variant gets its own row in the
-- dashboard and each one's total looks smaller than the real, combined
-- number — with no error or warning, because nothing is technically wrong
-- with either row.
--
-- This is a plausible root cause for a value that looks too low for one
-- specific area/month: part of that area's real total may be sitting under
-- a near-identical, easy-to-miss variant name elsewhere in the areas list.
--
-- Run this read-only in the Supabase SQL Editor — it's ONE query (a UNION
-- ALL of the four checks) so it shows every result at once; earlier this
-- was four separate SELECT statements, and Supabase's SQL Editor only
-- displays the last one's result when you run several together, which
-- silently hid the area/item/rep checks behind whatever the cluster check
-- found. If this returns no rows, all four are genuinely clean.
--
-- For every row it does return, look at the `raw_value` column for that
-- dataset — if you see more than one visually-similar spelling of what
-- should be the same area/item/rep/cluster, that's the bug. If everything
-- you see is genuinely different names that just happen to share letters,
-- there's nothing to do.

with area_variants as (
  select dataset_id, area, lower(trim(area)) as norm
  from public.lumen_sales_records
),
area_dupes as (
  select dataset_id, norm from area_variants group by dataset_id, norm having count(distinct area) > 1
),
item_variants as (
  select dataset_id, item, lower(trim(item)) as norm
  from public.lumen_sales_records
),
item_dupes as (
  select dataset_id, norm from item_variants group by dataset_id, norm having count(distinct item) > 1
),
rep_variants as (
  select dataset_id, rep, lower(trim(rep)) as norm
  from public.lumen_sales_records
  where rep is not null
),
rep_dupes as (
  select dataset_id, norm from rep_variants group by dataset_id, norm having count(distinct rep) > 1
),
cluster_variants as (
  select dataset_id, cluster, lower(trim(cluster)) as norm
  from public.lumen_sales_records
  where cluster is not null
),
cluster_dupes as (
  select dataset_id, norm from cluster_variants group by dataset_id, norm having count(distinct cluster) > 1
)
select 'area' as column_checked, s.dataset_id, s.area as raw_value,
       count(*) as row_count, sum(s.sales_value) as total_value,
       min(s.month) as min_month, max(s.month) as max_month
from public.lumen_sales_records s
join area_dupes d on d.dataset_id = s.dataset_id and lower(trim(s.area)) = d.norm
group by s.dataset_id, s.area

union all

select 'item', s.dataset_id, s.item,
       count(*), sum(s.sales_value), min(s.month), max(s.month)
from public.lumen_sales_records s
join item_dupes d on d.dataset_id = s.dataset_id and lower(trim(s.item)) = d.norm
group by s.dataset_id, s.item

union all

select 'rep', s.dataset_id, s.rep,
       count(*), sum(s.sales_value), min(s.month), max(s.month)
from public.lumen_sales_records s
join rep_dupes d on d.dataset_id = s.dataset_id and lower(trim(s.rep)) = d.norm
group by s.dataset_id, s.rep

union all

select 'cluster', s.dataset_id, s.cluster,
       count(*), sum(s.sales_value), min(s.month), max(s.month)
from public.lumen_sales_records s
join cluster_dupes d on d.dataset_id = s.dataset_id and lower(trim(s.cluster)) = d.norm
group by s.dataset_id, s.cluster

order by column_checked, dataset_id, raw_value;
