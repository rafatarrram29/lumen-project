-- Finds the exact pattern that explained the "Domiat 1" value anomaly,
-- across EVERY area, month, and dataset at once: more than one distinct
-- source_file feeding the same area/month. That's not a bug the app can
-- reject on its own (nothing about a second, genuinely different file is
-- technically wrong), but it's the #1 practical reason a number looks
-- lower or higher than expected — a leftover test/sample upload never got
-- replaced by the real file, so the report is summing both together.
--
-- Run this read-only in the Supabase SQL Editor.

-- PART 1 — every area/month/year that currently has more than one source
-- file contributing to it, with each file's own row count and value so you
-- can see which one looks like the odd one out (check the file name for
-- "test", "sample", "demo", "draft", "old", "backup", "copy", a trailing
-- "(1)"/"(2)" from a re-downloaded file, etc).
select
  dataset_id, area, year, month,
  source_file,
  count(*) as row_count,
  sum(sales_value) as total_value,
  min(uploaded_at) as earliest_upload,
  max(uploaded_at) as latest_upload
from public.lumen_sales_records
where (dataset_id, area, year, month) in (
  select dataset_id, area, year, month
  from public.lumen_sales_records
  group by dataset_id, area, year, month
  having count(distinct source_file) > 1
)
group by dataset_id, area, year, month, source_file
order by dataset_id, area, year, month, earliest_upload;

-- PART 2 — every source_file name currently in use, in case an obviously
-- test/sample/temporary file (by name) is still contributing to real
-- numbers even where it happens to be the ONLY source for that area/month
-- (so PART 1 wouldn't catch it). Skim the file_name column for anything
-- that doesn't look like a real production export.
select
  dataset_id,
  source_file as file_name,
  count(*) as row_count,
  sum(sales_value) as total_value,
  count(distinct area) as areas_touched,
  min(uploaded_at) as earliest_upload,
  max(uploaded_at) as latest_upload
from public.lumen_sales_records
group by dataset_id, source_file
order by dataset_id, earliest_upload;
