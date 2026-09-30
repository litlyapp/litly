-- ============================================================
-- Privacy fix: public.users was readable by anyone.
-- The base schema's "Users are publicly readable" policy (using true)
-- let the public anon key — shipped in every browser — list every
-- user's email address. Every app read of public.users with a normal
-- session is the user's own row (role / display_name); cross-user
-- lookups (team page, invites) already use the service role, which
-- bypasses RLS. So restrict SELECT to the row's owner.
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor).
-- ============================================================

drop policy if exists "Users are publicly readable" on public.users;

drop policy if exists "Users can view their own record" on public.users;
create policy "Users can view their own record"
  on public.users for select
  using (auth.uid() = id);
