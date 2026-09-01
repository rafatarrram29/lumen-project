-- Read-only audit: finds every duplicate-identity group across ALL
-- datasets in lumen_sales_records, before you touch anything. Run this
-- FIRST — nothing here deletes or changes data.
--
-- "Duplicate" here means two or more rows that share the same dataset,
-- year, month, area, item, and rep (rep compared with coalesce so two
-- "no rep" rows still count as the same identity) — i.e. rows that
-- should logically be exactly one row, per the new
-- lumen_sales_records_identity_idx constraint in
-- lumen_data_integrity_migration.sql.

-- STEP 1 — how many duplicate groups exist, per dataset, and how much
-- extra "phantom" value they've added to that dataset's numbers.
select
  d.name as dataset_name,
  s.dataset_id,
  count(*) filter (where s.copies > 1) as duplicate_groups,
  sum(s.copies - 1) filter (where s.copies > 1) as extra_rows,
  sum((s.copies - 1) * s.sales_value) filter (where s.copies > 1) as inflated_value_total
from (
  select
    dataset_id, year, month, area, item, coalesce(rep, '') as rep_key,
    count(*) as copies,
    max(sales_value) as sales_value
  from public.lumen_sales_records
  group by dataset_id, year, month, area, item, coalesce(rep, '')
) s
join public.lumen_datasets d on d.id = s.dataset_id
group by d.name, s.dataset_id
having count(*) filter (where s.copies > 1) > 0
order by extra_rows desc;

-- STEP 2 — the actual duplicate rows, so you can eyeball whether they
-- look like an exact re-upload (same sales_value/qty every time — safe
-- to dedupe) or genuinely conflicting values (needs a manual decision,
-- not an automatic delete). Flags each group as SAFE_TO_DEDUPE only when
-- every copy has an identical sales_value and sales_qty.
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
