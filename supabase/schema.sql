-- litly database schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

-- Enums
create type user_role as enum ('patron', 'organizer');
create type event_type as enum ('in_person', 'virtual');
create type org_type as enum ('individual', 'organization');
create type genre as enum (
  'poetry',
  'fiction',
  'nonfiction',
  'essay',
  'hybrid_experimental',
  'translation',
  'ya',
  'craft_talk',
  'open_mic',
  'mixed',
  'workshop'
);

-- Users (mirrors auth.users, stores app-level role)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role user_role not null default 'patron',
  display_name text,
  created_at timestamptz not null default now()
);

-- Organizer profiles
create table public.organizer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  org_type org_type not null,
  name text not null,
  bio text,
  website text,
  social_links jsonb,
  unique (user_id)
);

-- Events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizer_profiles(id) on delete cascade,
  title text not null,
  description text,
  genre genre not null,
  event_type event_type not null,
  date_time timestamptz not null,
  end_time timestamptz,
  location_name text,
  address text,
  city text,
  country text,
  lat double precision,
  lng double precision,
  virtual_url text,
  open_mic boolean not null default false,
  featured_readers jsonb,
  rsvp_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create index events_date_time_idx on public.events(date_time);
create index events_organizer_id_idx on public.events(organizer_id);
create index events_genre_idx on public.events(genre);
create index events_event_type_idx on public.events(event_type);

-- Saved events
create table public.saved_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

-- RSVPs
create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

-- Follows (patron → organizer)
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  patron_id uuid not null references public.users(id) on delete cascade,
  organizer_id uuid not null references public.organizer_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (patron_id, organizer_id)
);

-- -------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------

alter table public.users enable row level security;
alter table public.organizer_profiles enable row level security;
alter table public.events enable row level security;
alter table public.saved_events enable row level security;
alter table public.rsvps enable row level security;
alter table public.follows enable row level security;

-- users: readable by anyone, writable only by the owner
create policy "Users are publicly readable"
  on public.users for select using (true);

create policy "Users can update their own record"
  on public.users for update using (auth.uid() = id);

-- organizer_profiles: readable by anyone, writable by owner
create policy "Organizer profiles are publicly readable"
  on public.organizer_profiles for select using (true);

create policy "Organizers can insert their own profile"
  on public.organizer_profiles for insert with check (auth.uid() = user_id);

create policy "Organizers can update their own profile"
  on public.organizer_profiles for update using (auth.uid() = user_id);

-- events: readable by anyone; CRUD by the organizer who owns it
create policy "Events are publicly readable"
  on public.events for select using (true);

create policy "Organizers can insert events"
  on public.events for insert with check (
    exists (
      select 1 from public.organizer_profiles
      where id = organizer_id and user_id = auth.uid()
    )
  );

create policy "Organizers can update their own events"
  on public.events for update using (
    exists (
      select 1 from public.organizer_profiles
      where id = organizer_id and user_id = auth.uid()
    )
  );

create policy "Organizers can delete their own events"
  on public.events for delete using (
    exists (
      select 1 from public.organizer_profiles
      where id = organizer_id and user_id = auth.uid()
    )
  );

-- saved_events: private to owner
create policy "Users can view their own saved events"
  on public.saved_events for select using (auth.uid() = user_id);

create policy "Users can save events"
  on public.saved_events for insert with check (auth.uid() = user_id);

create policy "Users can unsave events"
  on public.saved_events for delete using (auth.uid() = user_id);

-- rsvps: private to owner
create policy "Users can view their own RSVPs"
  on public.rsvps for select using (auth.uid() = user_id);

create policy "Users can RSVP"
  on public.rsvps for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.events where id = event_id and rsvp_enabled = true)
  );

create policy "Users can cancel their RSVP"
  on public.rsvps for delete using (auth.uid() = user_id);

-- follows: private to owner
create policy "Users can view their own follows"
  on public.follows for select using (auth.uid() = patron_id);

create policy "Users can follow organizers"
  on public.follows for insert with check (auth.uid() = patron_id);

create policy "Users can unfollow organizers"
  on public.follows for delete using (auth.uid() = patron_id);

-- -------------------------------------------------------
-- Trigger: auto-insert into public.users on auth signup
-- -------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, role, display_name)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'patron'),
    new.raw_user_meta_data->>'display_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
