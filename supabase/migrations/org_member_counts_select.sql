-- ============================================================
-- Dashboard RSVP/save counts: org members must be able to SELECT
-- rsvps and saved_events rows for events their org owns. The base
-- schema only allows owners to see their own rows, which would make
-- dashboard counts show 0. The live DB may already have an
-- equivalent policy added by hand — RLS policies are permissive
-- (OR-ed), so re-adding under a canonical name is harmless.
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor).
-- ============================================================

drop policy if exists "Org members can view RSVPs for their events" on public.rsvps;
create policy "Org members can view RSVPs for their events"
  on public.rsvps for select
  using (
    exists (
      select 1
      from public.events e
      join public.org_members m on m.org_id = e.organizer_id
      where e.id = event_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Org members can view saves for their events" on public.saved_events;
create policy "Org members can view saves for their events"
  on public.saved_events for select
  using (
    exists (
      select 1
      from public.events e
      join public.org_members m on m.org_id = e.organizer_id
      where e.id = event_id
        and m.user_id = auth.uid()
    )
  );
