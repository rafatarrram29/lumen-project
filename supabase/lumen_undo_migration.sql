-- Adds Undo support for inline edits. Run this once in the Supabase SQL
-- Editor, after lumen_inline_edits_migration.sql.
--
-- Purely additive: one new defaulted column, so every existing
-- lumen_data_edits row (all recorded before Undo existed) is automatically
-- treated as a regular edit, not an undo.

alter table public.lumen_data_edits
  add column if not exists is_undo boolean not null default false;
