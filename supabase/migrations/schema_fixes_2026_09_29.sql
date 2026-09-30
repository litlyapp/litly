-- ============================================================
-- Fixes found while snapshotting the live schema (2026-09-29).
-- Run in the Supabase SQL Editor AFTER the matching app deploy
-- (BannerUpload/AvatarUpload removal fallback, account-delete cleanup).
-- ============================================================

-- 0. (Already applied 2026-09-29.) Column the code has used since
--    2026-06-24 but that was never created — org profile saves and the
--    calendar-feed sync failed without it.
alter table public.organizer_profiles add column if not exists default_banner_url text;

-- 1. Draft visibility by org membership, not the legacy
--    organizer_profiles.user_id owner. The old policy hid drafts from
--    editors, co-admins, and every org after a user's first.
drop policy if exists "orgs see own drafts" on public.events;
drop policy if exists "Org members see published events and their drafts" on public.events;
create policy "Org members see published events and their drafts"
  on public.events for select to authenticated
  using (
    is_published = true
    or exists (
      select 1 from public.org_members m
      where m.org_id = events.organizer_id and m.user_id = auth.uid()
    )
  );

-- 2. Storage: drop the loose banner policies (any signed-in user could
--    delete or overwrite any banner). The owner-folder-scoped policies
--    ("Users can upload/delete their own banners") remain. Also drop a
--    duplicate public-read policy.
drop policy if exists "Authenticated users can delete their banners" on storage.objects;
drop policy if exists "Authenticated users can upload event banners" on storage.objects;
drop policy if exists "Anyone can view event banners" on storage.objects;

-- 3. Deleting an account must not cascade-delete an org other members
--    still use. Sole-member orgs are removed by /api/account/delete.
alter table public.organizer_profiles
  drop constraint organizer_profiles_user_id_fkey,
  add constraint organizer_profiles_user_id_fkey
    foreign key (user_id) references public.users(id) on delete set null;
