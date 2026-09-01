-- Safe fix for the whitespace half of what lumen_name_variants_audit.sql
-- finds: trims leading/trailing spaces from area/item/rep/line in
-- lumen_sales_records. Trimming can only ever MERGE rows that were always
-- meant to be the same name (a stray space is never meaningful) — it never
-- changes what a name means, so this is safe to run directly, unlike a
-- case-folding merge (e.g. "Domiat 1" vs "DOMIAT 1"), which this script
-- deliberately does NOT do — review those by hand using the audit query
-- first, since a capitalization difference could occasionally be
-- intentional.
--
-- Run this AFTER reviewing lumen_name_variants_audit.sql and BEFORE
-- lumen_data_integrity_migration.sql (the new unique index would otherwise
-- block a trim that happens to merge two rows into an exact duplicate —
-- see the note below).
--
-- If this UPDATE fails with a unique-violation (23505): that means two
-- variant rows (e.g. "Domiat 1" and "Domiat 1 ") were already identical in
-- every other column including sales_value/sales_qty once the whitespace is
-- removed — i.e. they're genuinely the same row typed twice, not just a
-- formatting accident. In that case, don't force this update; instead
-- delete one of the two rows by id first (same logic as lumen_dedupe.sql),
-- then re-run this script.

update public.lumen_sales_records
set area = trim(area)
where area <> trim(area);

update public.lumen_sales_records
set item = trim(item)
where item <> trim(item);

update public.lumen_sales_records
set rep = trim(rep)
where rep is not null and rep <> trim(rep);

update public.lumen_sales_records
set line = trim(line)
where line is not null and line <> trim(line);

-- Re-run lumen_name_variants_audit.sql afterwards — any group that was
-- purely a whitespace difference should no longer appear. Only genuine
-- case-difference groups (if any) will remain, for you to review by hand.
