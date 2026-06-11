-- Optional suite/apt/unit line, kept separate from the street address.
-- Nominatim fails to geocode addresses with suite suffixes ("123 Main St
-- Suite 200"), so the street address must stay clean for the map pin while
-- the unit still displays on the event page.
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor).

alter table public.events add column if not exists address2 text;
