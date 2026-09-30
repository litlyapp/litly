-- ============================================================
-- LIVE SCHEMA SNAPSHOT — source of truth for the production database.
-- Captured 2026-09-29 from the live Supabase project (pg_catalog +
-- PostgREST), reflecting migrations/schema_fixes_2026_09_29.sql.
--
-- schema.sql and migrations/ are the historical record of how the DB got
-- here (several changes were made directly in the dashboard and never
-- saved as files). When you change the live schema, add a migration AND
-- update this file so it stays accurate.
-- ============================================================

-- ---------- Enums ----------
create type public.user_role     as enum ('patron', 'organizer');
create type public.event_type    as enum ('in_person', 'virtual');
create type public.org_type      as enum ('individual', 'organization');
-- essay, hybrid_experimental: retired (display labels only; Postgres can't drop enum values)
create type public.genre         as enum ('poetry', 'fiction', 'nonfiction', 'essay', 'hybrid_experimental',
  'translation', 'ya', 'craft_talk', 'open_mic', 'workshop', 'in_conversation', 'slam', 'other');
create type public.import_status as enum ('pending', 'approved', 'rejected'); -- retired pipeline

-- ---------- Tables ----------
create table public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  role         public.user_role not null default 'patron',
  display_name text,
  created_at   timestamptz not null default now()
);

create table public.organizer_profiles (
  id                             uuid primary key default gen_random_uuid(),
  -- legacy "creator" of a user's FIRST org only; authority lives in org_members
  user_id                        uuid unique references public.users(id) on delete set null,
  org_type                       public.org_type not null,
  name                           text not null,
  bio                            text,
  website                        text,
  social_links                   jsonb,
  avatar_url                     text,
  calendar_feed_url              text,
  calendar_feed_default_genre    text[],  -- genre values stored as text
  calendar_feed_last_synced_at   timestamptz,
  calendar_feed_last_status      text,    -- 'success' | 'error'
  calendar_feed_last_error       text,
  default_banner_url             text,
  default_banner_for_all_events  boolean not null default false
);

create table public.events (
  id                        uuid primary key default gen_random_uuid(),
  organizer_id              uuid not null references public.organizer_profiles(id) on delete cascade,
  title                     text not null,
  description               text,        -- may contain **bold** / *italic*
  genre                     public.genre[] not null,  -- empty array = matches every genre filter
  event_type                public.event_type not null,
  date_time                 timestamptz not null,
  end_time                  timestamptz,
  timezone                  text,        -- IANA; null = legacy (UTC digits shown as local)
  location_name             text,
  address                   text,        -- street line only (geocoding)
  address2                  text,
  city                      text,
  state                     text,
  zip_code                  text,
  country                   text,
  lat                       double precision,
  lng                       double precision,
  virtual_url               text,
  open_mic                  boolean not null default false,
  featured_readers          jsonb,       -- [{name, url, bio?}]
  rsvp_enabled              boolean not null default false,
  is_imported               boolean not null default false,
  source_url                text,
  source_name               text,
  banner_url                text,
  ticket_url                text,
  ticket_type               text check (ticket_type in ('paid', 'free', 'none')),
  view_count                integer not null default 0,
  ticket_click_count        integer not null default 0,
  recurrence_rule           jsonb,       -- series parent only
  parent_event_id           uuid references public.events(id) on delete set null,
  is_ongoing                boolean not null default false,
  series_end_date           date,
  is_cancelled              boolean not null default false,
  is_published              boolean not null default true,  -- false = draft
  external_uid              text,        -- iCal UID
  -- 2nd FK to organizer_profiles: every embed must use
  -- organizer:organizer_profiles!events_organizer_id_fkey(...)
  feed_source_organizer_id  uuid references public.organizer_profiles(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table public.saved_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create table public.rsvps (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create table public.follows (
  id           uuid primary key default gen_random_uuid(),
  patron_id    uuid not null references public.users(id) on delete cascade,
  organizer_id uuid not null references public.organizer_profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (patron_id, organizer_id)
);

create table public.org_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizer_profiles(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  role       text not null check (role in ('admin', 'editor')),
  created_at timestamptz default now(),
  unique (org_id, user_id)
);

create table public.org_invites (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizer_profiles(id) on delete cascade,
  email        text not null,
  token        uuid not null default gen_random_uuid(),
  invited_by   uuid references public.users(id) on delete set null,
  invited_role text not null default 'editor' check (invited_role in ('admin', 'editor')),
  created_at   timestamptz default now(),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  unique (org_id, email)
);

-- Monthly URL-import counter (see increment_import_usage). month = first of month,
-- stored as text ('YYYY-MM-DD'); the function's date value is cast on insert.
create table public.org_import_usage (
  org_id     uuid not null,
  month      text not null,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (org_id, month)
);

-- Retired newsletter-import queue (pipeline removed 2026-09-08). Unused; safe to drop.
create table public.pending_imports (
  id             uuid primary key default gen_random_uuid(),
  source_email   text,
  source_subject text,
  raw_body       text not null,
  parsed_data    jsonb,
  status         public.import_status not null default 'pending',
  created_at     timestamptz not null default now()
);

-- ---------- Indexes (beyond PK / unique constraints) ----------
create index events_date_time_idx                on public.events (date_time);
create index events_organizer_id_idx             on public.events (organizer_id);
create index events_genre_idx                    on public.events (genre);
create index events_event_type_idx               on public.events (event_type);
create index events_parent_event_id_idx          on public.events (parent_event_id);
create index events_feed_source_organizer_id_idx on public.events (feed_source_organizer_id);
-- NOT partial: upsert onConflict needs a full index
create unique index events_org_external_uid_idx  on public.events (organizer_id, external_uid);
create index follows_organizer_id_idx            on public.follows (organizer_id);
create index org_invites_invited_by_idx          on public.org_invites (invited_by);
create index org_members_user_id_idx             on public.org_members (user_id);
create index rsvps_event_id_idx                  on public.rsvps (event_id);
create index saved_events_event_id_idx           on public.saved_events (event_id);

-- ---------- Functions & triggers ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.users (id, email, role, display_name)
  values (new.id, new.email,
          coalesce((new.raw_user_meta_data->>'role')::user_role, 'patron'),
          new.raw_user_meta_data->>'display_name');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();

create or replace function public.increment_event_view(event_id uuid) returns void
language sql security definer as $$
  update events set view_count = view_count + 1 where id = event_id; $$;

create or replace function public.increment_ticket_click(event_id uuid) returns void
language sql security definer as $$
  update events set ticket_click_count = ticket_click_count + 1 where id = event_id; $$;

-- Returns the new monthly count, or -1 once p_limit is exceeded.
create or replace function public.increment_import_usage(p_org_id uuid, p_limit integer) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  v_month date := date_trunc('month', now())::date;
  v_count int;
begin
  insert into public.org_import_usage (org_id, month, count) values (p_org_id, v_month, 1)
  on conflict (org_id, month) do update set count = org_import_usage.count + 1
  returning count into v_count;
  if v_count > p_limit then return -1; end if;
  return v_count;
end; $$;

-- ---------- Row Level Security (enabled on every public table) ----------
-- users
create policy "Users can view their own record"   on public.users for select using (auth.uid() = id);
create policy "Users can update their own record" on public.users for update using (auth.uid() = id);

-- organizer_profiles
create policy "Organizer profiles are publicly readable" on public.organizer_profiles for select using (true);
create policy "Organizers can insert their own profile"  on public.organizer_profiles for insert with check (auth.uid() = user_id);
create policy "Org admins can update org profiles" on public.organizer_profiles for update using (
  exists (select 1 from org_members where org_id = organizer_profiles.id and user_id = auth.uid() and role = 'admin'));

-- events (drafts: is_published = false)
create policy "published events only for public" on public.events for select to anon using (is_published = true);
create policy "Org members see published events and their drafts" on public.events for select to authenticated using (
  is_published = true
  or exists (select 1 from org_members m where m.org_id = events.organizer_id and m.user_id = auth.uid()));
create policy "Org members can insert events" on public.events for insert with check (
  exists (select 1 from org_members where org_id = events.organizer_id and user_id = auth.uid()));
create policy "Org members can update events" on public.events for update using (
  exists (select 1 from org_members where org_id = events.organizer_id and user_id = auth.uid()));
create policy "Org members can delete events" on public.events for delete using (
  exists (select 1 from org_members where org_id = events.organizer_id and user_id = auth.uid()));

-- saved_events
create policy "Users can view their own saved events" on public.saved_events for select using (auth.uid() = user_id);
create policy "Users can save events"   on public.saved_events for insert with check (auth.uid() = user_id);
create policy "Users can unsave events" on public.saved_events for delete using (auth.uid() = user_id);
create policy "Org members can view saves for their events" on public.saved_events for select using (
  exists (select 1 from events e join org_members m on m.org_id = e.organizer_id
          where e.id = saved_events.event_id and m.user_id = auth.uid()));

-- rsvps
create policy "Users can view their own RSVPs" on public.rsvps for select using (auth.uid() = user_id);
create policy "Users can RSVP" on public.rsvps for insert with check (
  auth.uid() = user_id and exists (select 1 from events where events.id = rsvps.event_id and events.rsvp_enabled = true));
create policy "Users can cancel their RSVP" on public.rsvps for delete using (auth.uid() = user_id);
create policy "Org members can view RSVPs for their events" on public.rsvps for select using (
  exists (select 1 from events e join org_members m on m.org_id = e.organizer_id
          where e.id = rsvps.event_id and m.user_id = auth.uid()));
-- legacy duplicate (owner-only subset of the above; harmless)
create policy "Organizers can view RSVPs for their events" on public.rsvps for select using (
  exists (select 1 from events e join organizer_profiles op on op.id = e.organizer_id
          where e.id = rsvps.event_id and op.user_id = auth.uid()));

-- follows
create policy "Users can view their own follows" on public.follows for select using (auth.uid() = patron_id);
create policy "Users can follow organizers"      on public.follows for insert with check (auth.uid() = patron_id);
create policy "Users can unfollow organizers"    on public.follows for delete using (auth.uid() = patron_id);

-- org_members (writes via service role only)
create policy "Users can view own memberships" on public.org_members for select using (user_id = auth.uid());

-- org_invites, org_import_usage: RLS on, no policies — service role / security-definer RPC only
-- pending_imports
create policy "No public access to pending imports" on public.pending_imports for all using (false);

-- ---------- Storage ----------
-- Buckets: event-banners (public, 5 MB limit), profile-avatars (public, no limit).
-- Uploads go to {auth.uid()}/{file}; only the uploader can write/delete.
create policy "Public can view banners" on storage.objects for select using (bucket_id = 'event-banners');
create policy "Users can upload their own banners" on storage.objects for insert to authenticated with check (
  bucket_id = 'event-banners' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete their own banners" on storage.objects for delete to authenticated using (
  bucket_id = 'event-banners' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Public can view avatars" on storage.objects for select using (bucket_id = 'profile-avatars');
create policy "Users can upload their own avatar" on storage.objects for insert to authenticated with check (
  bucket_id = 'profile-avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete their own avatar" on storage.objects for delete to authenticated using (
  bucket_id = 'profile-avatars' and auth.uid()::text = (storage.foldername(name))[1]);
