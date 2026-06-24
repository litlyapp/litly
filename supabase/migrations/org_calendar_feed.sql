-- ============================================================
-- Org calendar feed sync: lets an org paste their iCal subscribe
-- URL and have events sync onto Litly automatically, attributed
-- to their own organizer profile (no manual posting).
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor).
-- ============================================================

alter table public.organizer_profiles
  add column if not exists calendar_feed_url text,
  add column if not exists calendar_feed_default_genre genre[],
  add column if not exists calendar_feed_last_synced_at timestamptz,
  add column if not exists calendar_feed_last_status text check (calendar_feed_last_status in ('success', 'error')),
  add column if not exists calendar_feed_last_error text;

-- WARNING: feed_source_organizer_id is a SECOND foreign key from events to
-- organizer_profiles (alongside organizer_id). This makes Supabase/PostgREST's
-- auto-join syntax `organizer:organizer_profiles(...)` ambiguous everywhere it's
-- used in the app, causing those queries to silently fail with "more than one
-- relationship was found" (this took the homepage, /events, /events/map, and
-- the calendar down on 2026-06-24). Every such embed had to be qualified with
-- `organizer:organizer_profiles!events_organizer_id_fkey(...)`.
-- If you ever add a THIRD foreign key from events to organizer_profiles,
-- grep the codebase for `organizer:organizer_profiles(` (unqualified, no `!fkey`
-- hint) BEFORE running the migration, and confirm every match still resolves
-- to the right relationship.
alter table public.events
  add column if not exists external_uid text,
  add column if not exists feed_source_organizer_id uuid references public.organizer_profiles(id) on delete set null;

-- NOT partial: a partial unique index (e.g. "where external_uid is not null")
-- is invisible to Supabase's .upsert({onConflict: "organizer_id,external_uid"}),
-- which emits a plain `ON CONFLICT (organizer_id, external_uid)` with no WHERE
-- clause — Postgres only matches that against a full index, so every upsert
-- failed with "no unique or exclusion constraint matching the ON CONFLICT
-- specification" until this was made non-partial. Manually-created events
-- (external_uid IS NULL) are unaffected: Postgres unique indexes never treat
-- NULL = NULL as a duplicate.
create unique index if not exists events_org_external_uid_idx
  on public.events (organizer_id, external_uid);

-- Verify:
-- select column_name from information_schema.columns where table_name = 'organizer_profiles' and column_name like 'calendar_feed%';
-- select column_name from information_schema.columns where table_name = 'events' and column_name in ('external_uid', 'feed_source_organizer_id');
