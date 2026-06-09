-- ============================================================
-- Litly Multi-User Orgs Migration
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. org_members: links users to organizer profiles with a role
create table if not exists public.org_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizer_profiles(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  role        text not null check (role in ('admin', 'editor')),
  created_at  timestamptz default now(),
  unique (org_id, user_id)
);

alter table public.org_members enable row level security;

create policy "Users can view own memberships"
  on public.org_members for select
  using (user_id = auth.uid());

-- 2. org_invites: pending email invitations to join an org
create table if not exists public.org_invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizer_profiles(id) on delete cascade,
  email       text not null,
  token       uuid not null default gen_random_uuid(),
  invited_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  unique (org_id, email)
);

alter table public.org_invites enable row level security;
-- No direct user access — all operations use the service role key

-- 3. Migrate existing organizers: make them admins of their own org
insert into public.org_members (org_id, user_id, role)
select id, user_id, 'admin'
from public.organizer_profiles
on conflict (org_id, user_id) do nothing;

-- 4. Swap events RLS: org members (admin or editor) can manage events
drop policy if exists "Organizers can insert events" on public.events;
drop policy if exists "Organizers can update their own events" on public.events;
drop policy if exists "Organizers can delete their own events" on public.events;

create policy "Org members can insert events"
  on public.events for insert
  with check (
    exists (
      select 1 from public.org_members
      where org_id = organizer_id
        and user_id = auth.uid()
    )
  );

create policy "Org members can update events"
  on public.events for update
  using (
    exists (
      select 1 from public.org_members
      where org_id = organizer_id
        and user_id = auth.uid()
    )
  );

create policy "Org members can delete events"
  on public.events for delete
  using (
    exists (
      select 1 from public.org_members
      where org_id = organizer_id
        and user_id = auth.uid()
    )
  );
