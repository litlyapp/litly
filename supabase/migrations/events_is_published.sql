-- Add is_published column to events table.
-- Default TRUE so all existing events remain live immediately.
-- Drafts (is_published = false) are hidden from public views.
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;
