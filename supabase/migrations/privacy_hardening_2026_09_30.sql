-- Privacy hardening from the 2026-09-30 audit. Safe to re-run.

-- 1. organizer_profiles: hide the account link (user_id) and calendar-feed
--    fields from the public API. A private iCal URL (e.g. Google Calendar's
--    "secret address") is a credential. The app reads these via the service
--    role after checking org membership.
--    NOTE: new columns added to this table later are NOT readable by
--    anon/authenticated until added to this grant list.
revoke select on public.organizer_profiles from anon, authenticated;
grant select (id, org_type, name, bio, website, social_links, avatar_url,
              default_banner_url, default_banner_for_all_events)
  on public.organizer_profiles to anon, authenticated;

-- Legacy duplicate of "Org members can view RSVPs for their events"; its
-- subquery reads organizer_profiles.user_id, which authenticated users can
-- no longer select, so it would make every RSVP read fail.
drop policy if exists "Organizers can view RSVPs for their events" on public.rsvps;

-- 2. URL-import counter: only a member of the org may bump its count
--    (previously any caller could burn another org's monthly quota).
create or replace function public.increment_import_usage(p_org_id uuid, p_limit integer) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  v_month date := date_trunc('month', now())::date;
  v_count int;
begin
  if not exists (select 1 from public.org_members where org_id = p_org_id and user_id = auth.uid()) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  insert into public.org_import_usage (org_id, month, count) values (p_org_id, v_month, 1)
  on conflict (org_id, month) do update set count = org_import_usage.count + 1
  returning count into v_count;
  if v_count > p_limit then return -1; end if;
  return v_count;
end; $$;
revoke execute on function public.increment_import_usage(uuid, integer) from public, anon;
grant execute on function public.increment_import_usage(uuid, integer) to authenticated;

-- View / ticket-click counters stay public (anonymous visitors trigger them)
-- but only count published events, with a pinned search_path.
create or replace function public.increment_event_view(event_id uuid) returns void
language sql security definer set search_path to 'public' as $$
  update public.events set view_count = view_count + 1
  where id = event_id and is_published; $$;

create or replace function public.increment_ticket_click(event_id uuid) returns void
language sql security definer set search_path to 'public' as $$
  update public.events set ticket_click_count = ticket_click_count + 1
  where id = event_id and is_published; $$;

-- 3. Storage: public buckets serve files by URL without any SELECT policy.
--    The old "public can view" policies also let anyone LIST every file
--    (exposing user-id folder names). Uploaders keep select on their own
--    folder, which upload/remove need.
drop policy if exists "Public can view banners" on storage.objects;
drop policy if exists "Public can view avatars" on storage.objects;
drop policy if exists "Users can view their own banners" on storage.objects;
drop policy if exists "Users can view their own avatars" on storage.objects;
create policy "Users can view their own banners" on storage.objects for select to authenticated using (
  bucket_id = 'event-banners' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can view their own avatars" on storage.objects for select to authenticated using (
  bucket_id = 'profile-avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- Server-side upload limits (matching the client's 3 MB / 5 MB checks);
-- raster images only — no SVG/HTML hosted from our storage domain.
update storage.buckets
  set file_size_limit = 3145728,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
  where id = 'profile-avatars';
update storage.buckets
  set file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
  where id = 'event-banners';
