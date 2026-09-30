-- Remove leftovers of the newsletter-import queue (pipeline retired 2026-09-08).
-- The table was already gone from the live DB by 2026-09-30; the enum type
-- only it used may remain. Safe to re-run.
drop table if exists public.pending_imports;
drop type if exists public.import_status;
