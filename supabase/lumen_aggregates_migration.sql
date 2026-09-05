-- Lumen: move the report's GROUP BY into the database.
--
-- Run this once in the Supabase SQL Editor. It creates a function and
-- grants execute on it — it reads nothing, writes nothing, and changes no
-- data, so it is safe to run on a live project and safe to run twice.
--
-- WHY
--
-- Building the dashboard used to mean shipping every raw sales row from
-- Postgres into the Node server on every page load. The engine then
-- immediately summed them into per-area, per-item, per-rep, per-month
-- totals. At a measured ~152 bytes on the wire per row that is 0.7 MB for a
-- small dataset and 83.5 MB for a large one, every load — and it grows with
-- the number of TRANSACTIONS, which is exactly the number that grows when
-- Lumen moves from one line to a whole company.
--
-- This function does that summing where the data already is. What comes
-- back is one row per (area, item, month, line, rep) instead of one row per
-- transaction, so the payload is bounded by the shape of the business —
-- how many areas, items and months there are — rather than by how much was
-- sold. Adding a year of extra invoices no longer costs anything to load.
--
-- The engine is unchanged and its tests still apply: the rows this returns
-- are the same shape it always consumed, only pre-summed, and every
-- grouping it performs is a coarsening of this one.
--
-- SECURITY INVOKER, deliberately and importantly: the function must run as
-- the caller so row-level security still decides which datasets they can
-- see. A SECURITY DEFINER version here would hand every user every user's
-- sales data.

create or replace function public.lumen_sales_aggregate(
  p_dataset_id uuid,
  p_year integer
)
returns table (
  id          bigint,
  area        text,
  family      text,
  month       integer,
  line        text,
  rep         text,
  sales_value numeric,
  sales_qty   numeric,
  is_edited   boolean,
  edited_at   timestamptz,
  edited_by   text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  -- An area's line, decided once here rather than per row.
  --
  -- The app's rule is "the most common non-empty label for this area, ties
  -- broken alphabetically, and a blank never outvotes a real one". That
  -- rule counts ROWS, so it has to be settled before the rows are summed
  -- away — otherwise a mis-keyed file could resolve differently through
  -- this path than through the raw one. Every row an area contributes then
  -- carries the winning label, which makes the app's own vote unanimous and
  -- lands on the same answer.
  with area_line as (
    select distinct on (area) area, line
    from (
      select area, line, count(*) as n
      from public.lumen_sales_records
      where dataset_id = p_dataset_id
        and year = p_year
        and line is not null
        and btrim(line) <> ''
      group by area, line
    ) counted
    order by area, n desc, line asc
  ),
  grouped as (
    select
      r.area,
      r.family,
      r.month,
      al.line                                  as line,
      r.rep,
      sum(r.sales_value)                       as sales_value,
      -- NULL quantities are ignored by sum(), which is what the app does
      -- with a missing quantity too. All-NULL stays NULL, i.e. "no figure".
      sum(r.sales_qty)                         as sales_qty,
      bool_or(coalesce(r.is_edited, false))    as is_edited,
      max(r.edited_at)                         as edited_at,
      -- Whoever made the most recent edit inside this group; the app then
      -- takes the most recent across groups for the same cell.
      (array_agg(r.edited_by order by r.edited_at desc nulls last))[1] as edited_by
    from public.lumen_sales_records r
    left join area_line al on al.area = r.area
    where r.dataset_id = p_dataset_id
      and r.year = p_year
    group by r.area, r.family, r.month, al.line, r.rep
  )
  select
    -- A stable, unique key so the caller can page through this safely.
    -- Paging without a total order is how rows go missing; see
    -- src/lib/lumen/fetchAllRows.ts.
    row_number() over (
      order by area, family, month, coalesce(line, ''), coalesce(rep, '')
    )::bigint as id,
    area, family, month, line, rep,
    sales_value, sales_qty, is_edited, edited_at, edited_by
  from grouped;
$$;

grant execute on function public.lumen_sales_aggregate(uuid, integer) to authenticated;

-- The aggregate scans one dataset-year and groups it. There is already an
-- index on dataset_id alone, but at company scale a dataset holds several
-- years, and narrowing on both before grouping is the difference between
-- reading a year and reading everything ever uploaded.
create index if not exists lumen_sales_records_dataset_year_idx
  on public.lumen_sales_records (dataset_id, year);
