-- Lumen security hardening. Run this once in the Supabase SQL Editor.
-- Safe to run more than once (every statement is idempotent), and safe to
-- run on a database with live data — it removes permissions, never rows.
--
-- Covers two findings from the audit:
--
--   S1 — an unrestricted DELETE policy ("using (true)") on the sales table
--        that let any signed-in account delete any other user's rows. RLS
--        policies are OR-ed, so its mere presence overrode the
--        ownership-scoped policy beside it.
--
--   S2 — sign-up accepted any email address on earth. Restricting it in the
--        browser alone is decorative: the anon key is public, so anyone can
--        call the sign-up endpoint directly. The only enforcement that
--        actually holds is at the database, below.

-- ─────────────────────────────────────────────────────────────────────
-- STEP 1 (S1) — remove every unrestricted policy on the sales table and
-- re-assert the ownership-scoped ones.
--
-- The re-upload path ("replace this month and upload it again") keeps
-- working on the scoped policy alone — an owner deleting rows in their own
-- dataset still passes, which is the only delete the app ever performs.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists "Authenticated users can delete lumen sales records"
  on public.lumen_sales_records;
drop policy if exists "Authenticated users can view lumen sales records"
  on public.lumen_sales_records;
drop policy if exists "Authenticated users can insert lumen sales records"
  on public.lumen_sales_records;

drop policy if exists "Users can delete rows in their own or legacy datasets"
  on public.lumen_sales_records;
create policy "Users can delete rows in their own or legacy datasets"
  on public.lumen_sales_records for delete
  to authenticated
  using (
    exists (
      select 1 from public.lumen_datasets d
      where d.id = lumen_sales_records.dataset_id
        and (d.user_id = auth.uid() or d.user_id is null)
    )
  );

-- Same treatment for the dataset table's own pre-isolation policies.
drop policy if exists "Authenticated users can view lumen datasets" on public.lumen_datasets;
drop policy if exists "Authenticated users can insert lumen datasets" on public.lumen_datasets;
drop policy if exists "Authenticated users can delete lumen datasets" on public.lumen_datasets;

-- ─────────────────────────────────────────────────────────────────────
-- STEP 2 (S2) — restrict which email domains may create an account.
--
-- The allow-list lives in a table rather than in code so you can change who
-- may sign up without a deploy. It starts EMPTY, and an empty list means
-- "allow everyone" — exactly the behaviour you have today, so running this
-- migration on its own changes nothing and cannot lock anyone out. The
-- restriction switches on the moment you insert your first domain (see the
-- commented line at the bottom of this file).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.lumen_allowed_email_domains (
  domain text primary key,
  added_at timestamptz not null default now()
);

-- No policies at all: nothing reads this table from the browser. The
-- trigger below reaches it as SECURITY DEFINER, and you manage it here in
-- the SQL Editor.
alter table public.lumen_allowed_email_domains enable row level security;

create or replace function public.lumen_enforce_signup_domain()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  configured integer;
  candidate  text;
begin
  select count(*) into configured from public.lumen_allowed_email_domains;

  -- Not configured yet → behave exactly as before, allow every address.
  if configured = 0 then
    return new;
  end if;

  -- Compare case-insensitively on the part after the last "@" — an address
  -- may legitimately contain an "@" inside a quoted local part, so taking
  -- the last one rather than splitting on the first is the safe read.
  candidate := lower(substring(new.email from '[^@]+$'));

  if not exists (
    select 1 from public.lumen_allowed_email_domains
    where lower(domain) = candidate
  ) then
    raise exception 'Sign-up is limited to approved email domains.'
      using errcode = 'P0001', hint = 'lumen_domain_not_allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists lumen_enforce_signup_domain on auth.users;
create trigger lumen_enforce_signup_domain
  before insert on auth.users
  for each row execute function public.lumen_enforce_signup_domain();

-- ─────────────────────────────────────────────────────────────────────
-- STEP 3 — switch the restriction on.
--
-- Uncomment and edit, or just run it separately whenever you're ready.
-- Existing accounts are never affected: the trigger only runs on new
-- sign-ups, so nobody already signed up can be locked out by this.
--
--   insert into public.lumen_allowed_email_domains (domain)
--   values ('yourcompany.com')
--   on conflict do nothing;
--
-- To see who is allowed:      select * from public.lumen_allowed_email_domains;
-- To lift the restriction:    delete from public.lumen_allowed_email_domains;
-- ─────────────────────────────────────────────────────────────────────
