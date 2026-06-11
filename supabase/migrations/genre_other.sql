-- Add "other" to the genre enum for events that don't fit existing categories.
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor).

alter type public.genre add value if not exists 'other';
