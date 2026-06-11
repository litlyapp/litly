-- Persist the postal code on events. Previously zip was a client-side helper
-- only (autofilled state/country, then discarded on save) and was missing
-- from geocode queries — international addresses (e.g. AU "QLD 4819") often
-- need it for Nominatim to resolve a map pin.
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor).

alter table public.events add column if not exists zip_code text;
