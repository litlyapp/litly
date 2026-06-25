-- Allow admins to pre-select a role when sending an invite (defaults to editor)
ALTER TABLE org_invites ADD COLUMN IF NOT EXISTS invited_role text NOT NULL DEFAULT 'editor'
  CHECK (invited_role IN ('admin', 'editor'));
