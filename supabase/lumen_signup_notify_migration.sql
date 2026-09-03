-- Adds first-time signup notification tracking to Lumen. Run this once in
-- the Supabase SQL Editor.
--
-- Lets the app record, per user, that an admin "new signup" email has
-- already been sent for that account. The primary key on user_id is what
-- actually enforces "only once, ever" — a second insert attempt for the
-- same user (e.g. clicking an old confirmation link again, or a
-- concurrent double-click) fails with a unique-violation, which the app
-- treats as "already notified" and skips sending another email. Regular
-- sign-ins never touch this table at all, so they can never re-trigger it.

create table if not exists public.lumen_signup_notifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  notified_at timestamptz not null default now()
);

alter table public.lumen_signup_notifications enable row level security;

-- A signed-in user may record (once) that their own signup was reported —
-- never another user's row, and there's no select/update/delete policy at
-- all, so nobody can read or tamper with this table from the client.
create policy "Users can record their own signup notification"
  on public.lumen_signup_notifications for insert
  to authenticated
  with check (user_id = auth.uid());
