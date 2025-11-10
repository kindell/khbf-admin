-- Add member_id column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE SET NULL;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_events_member_id ON events(member_id);

-- Backfill member_id for existing events using f0 matching
-- This will match events.userid to members via Aptus Users.f0 = members.fortnox_customer_number
-- Note: This requires manual execution or a separate script since we need to query Aptus MSSQL

COMMENT ON COLUMN events.member_id IS 'Foreign key to members table, set via f0 member number matching from Aptus';
