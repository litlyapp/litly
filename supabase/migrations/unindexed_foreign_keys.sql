-- ============================================================
-- Fix: Unindexed foreign keys (flagged by Supabase Performance Advisor)
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Run EACH statement separately (one at a time) — CONCURRENTLY cannot
-- run inside a transaction block, and the SQL editor may batch
-- multiple statements into one if you run them all at once.
-- ============================================================

create index concurrently if not exists events_parent_event_id_idx
  on public.events(parent_event_id);

create index concurrently if not exists events_feed_source_organizer_id_idx
  on public.events(feed_source_organizer_id);

create index concurrently if not exists follows_organizer_id_idx
  on public.follows(organizer_id);

create index concurrently if not exists org_invites_invited_by_idx
  on public.org_invites(invited_by);

create index concurrently if not exists org_members_user_id_idx
  on public.org_members(user_id);

create index concurrently if not exists rsvps_event_id_idx
  on public.rsvps(event_id);

create index concurrently if not exists saved_events_event_id_idx
  on public.saved_events(event_id);
