-- Toggle: apply org default banner to ALL new events, not just iCal imports.
ALTER TABLE organizer_profiles ADD COLUMN IF NOT EXISTS default_banner_for_all_events boolean NOT NULL DEFAULT false;
