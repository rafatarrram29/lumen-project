-- Diagnose and fix duplicate rows in lumen_sales_records.
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).
--
-- Root cause: the table has no customer_id column (by design — see
-- lumen_schema.sql), so uploading the exact same monthly file twice
-- inserts a full second copy of every row for that area/item/month,
-- inflating that month's totals and producing unrealistic % changes
-- (e.g. "+256%" for a real area).
--
-- STEP 1 — run this SELECT first to see how bad it is. Each row shown
-- is one duplicate GROUP (area+item+family+sales_qty+sales_value+
-- month+year identical across 2+ rows) and how many extra copies exist.

select
  area, item, family, sales_qty, sales_value, month, year,
  count(*) as copies
from public.lumen_sales_records
group by area, item, family, sales_qty, sales_value, month, year
having count(*) > 1
order by copies desc;

-- STEP 2 — once you've confirmed the duplicates above look like a
-- re-uploaded file (not a real coincidence), run this to remove the
-- extra copies. It keeps the single earliest row (lowest id) of every
-- duplicate group and deletes the rest.

delete from public.lumen_sales_records t
using public.lumen_sales_records t2
where t.id > t2.id
  and t.area = t2.area
  and t.item = t2.item
  and t.family = t2.family
  and t.month = t2.month
  and t.year = t2.year
  and t.sales_value = t2.sales_value
  and coalesce(t.sales_qty, -1) = coalesce(t2.sales_qty, -1);

-- STEP 3 — re-run the STEP 1 query. It should now return zero rows.
