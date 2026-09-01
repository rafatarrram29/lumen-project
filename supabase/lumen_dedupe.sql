-- Diagnose and fix EXACT duplicate rows in lumen_sales_records, across
-- every dataset. Run this once in the Supabase SQL Editor (Project -> SQL
-- Editor -> New query) — after reviewing lumen_data_integrity_audit.sql
-- first, which shows the same groups broken out per dataset with a
-- SAFE_TO_DEDUPE / NEEDS_MANUAL_REVIEW flag.
--
-- This script only ever deletes a row when every copy in its group has
-- the IDENTICAL sales_value and sales_qty (STEP 3's DELETE explicitly
-- matches on both, on top of dataset+area+item+month+year+rep) — the
-- SAFE_TO_DEDUPE case: the same logical row genuinely got inserted more
-- than once (a retried upload, a double-submit). It never touches a group
-- where the copies have different values — that's normal for a source
-- file with finer granularity than one row per area/item/month (e.g. one
-- row per invoice or per branch), which the app already sums correctly;
-- see the note in lumen_data_integrity_audit.sql before assuming those
-- need any cleanup at all. lumen_data_integrity_migration.sql adds a
-- database constraint (on the same full-row match, value included) that
-- stops the true duplicate case from happening again going forward; this
-- script only cleans up rows written before that existed.
--
-- IMPORTANT — this version fixes a real bug in an earlier copy of this
-- script: it did not scope by dataset_id, so two unrelated datasets that
-- happened to share an area name, item name, month, value, and quantity
-- (entirely possible — e.g. a "Legacy data" dataset and a newer one) could
-- have had a real, distinct row deleted by mistake. Every query below is
-- scoped per dataset_id.

-- STEP 1 — run this SELECT first to see how bad it is. Each row shown is
-- one duplicate GROUP (same dataset+area+item+month+year+rep) and how
-- many extra copies exist, plus whether every copy has the identical
-- value (safe to auto-dedupe) or the copies actually disagree with each
-- other (needs your judgment before deleting anything — see STEP 2).

select
  dataset_id, area, item, month, year,
  coalesce(rep, '(no rep)') as rep,
  count(*) as copies,
  count(distinct (sales_value, coalesce(sales_qty, -1))) as distinct_values
from public.lumen_sales_records
group by dataset_id, area, item, month, year, rep
having count(*) > 1
order by copies desc;

-- STEP 2 — for any group above with distinct_values > 1 (the copies
-- actually disagree), STOP — decide by hand which value is correct
-- (check the original source file), then delete the wrong row(s)
-- individually by id. Do NOT run STEP 3 until every remaining group has
-- distinct_values = 1.

-- STEP 3 — once every remaining duplicate group has identical values in
-- every copy (distinct_values = 1), run this to remove the extra copies.
-- It keeps the single earliest row (lowest id) of every duplicate group,
-- scoped per dataset, and deletes the rest.

delete from public.lumen_sales_records t
using public.lumen_sales_records t2
where t.id > t2.id
  and t.dataset_id = t2.dataset_id
  and t.area = t2.area
  and t.item = t2.item
  and t.month = t2.month
  and t.year = t2.year
  and coalesce(t.rep, '') = coalesce(t2.rep, '')
  and t.sales_value = t2.sales_value
  and coalesce(t.sales_qty, -1) = coalesce(t2.sales_qty, -1);

-- STEP 4 — re-run the STEP 1 query. It should now return zero rows (or
-- only NEEDS_MANUAL_REVIEW groups you're intentionally leaving for now).
