-- ============================================================
-- Fix: "Edit org profile" silently fails for co-admins and for
-- additional orgs (organizer_profiles.user_id is null for those).
-- The old update policy only matched the original owner; this
-- swaps it for an org_members admin check, consistent with the
-- events policies in org_multi_user.sql.
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor).
-- ============================================================

drop policy if exists "Organizers can update their own profile" on public.organizer_profiles;

create policy "Org admins can update org profiles"
  on public.organizer_profiles for update
  using (
    exists (
      select 1 from public.org_members
      where org_id = id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );
