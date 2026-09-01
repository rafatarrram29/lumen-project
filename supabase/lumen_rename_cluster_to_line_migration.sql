-- Pure naming correction: renames the "Cluster" grouping level to "Line"
-- everywhere, both the two database columns it's stored in and the saved
-- column-mapping configuration every existing dataset already has.
--
-- Run this BEFORE deploying the matching code change (the app is being
-- updated to query/insert/read a "line" name, not "cluster", right after
-- this runs) — the two must not be out of sync, since unlike an additive
-- migration, a rename breaks EVERY query and every dataset's saved mapping
-- until all four statements below and the code agree on the name.

-- RENAME COLUMN is metadata-only in Postgres — it does not rewrite the
-- table, touch any existing row's data, or change any value.
alter table public.lumen_sales_records
  rename column cluster to line;

alter table public.lumen_dataset_records
  rename column cluster to line;

-- The column mapping every dataset saved when it was first set up (which
-- of its own file's columns means "Cluster") is stored as JSON, e.g.
-- {"area":"Region","item":"Product",...,"cluster":"Territory Group"}. A
-- plain column rename doesn't touch values *inside* a jsonb column, so
-- without this, every existing dataset's saved mapping would silently stop
-- recognizing its own Line column the moment the app starts reading the
-- "line" key instead of "cluster". This renames the JSON key itself,
-- leaving every other key and every dataset that never had a
-- Cluster/Line column (cluster: null) untouched.
update public.lumen_datasets
set column_mapping = (column_mapping - 'cluster') || jsonb_build_object('line', column_mapping->'cluster')
where column_mapping ? 'cluster';

update public.lumen_dataset_files
set column_mapping = (column_mapping - 'cluster') || jsonb_build_object('line', column_mapping->'cluster')
where column_mapping ? 'cluster';

-- A linked file's join_keys is a plain text array (e.g. {area,rep,cluster})
-- recording which columns it's actually joined by — same idea, renaming
-- the value in place.
update public.lumen_dataset_files
set join_keys = array_replace(join_keys, 'cluster', 'line')
where 'cluster' = any(join_keys);
