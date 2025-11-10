import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function addMemberIdColumn() {
  console.log('🔧 Adding member_id column to events table...\n');

  // This requires direct SQL access - we need to run this in Supabase SQL Editor
  const sql = `
-- Add member_id column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE SET NULL;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_events_member_id ON events(member_id);

COMMENT ON COLUMN events.member_id IS 'Foreign key to members table, set via f0 member number matching from Aptus';
  `;

  console.log('📋 SQL to run in Supabase SQL Editor:');
  console.log(sql);
  console.log('\n⚠️  This requires admin access. Please run the above SQL in Supabase SQL Editor.');
  console.log('🔗 URL: https://supabase.com/dashboard/project/YOUR_PROJECT/sql');
}

addMemberIdColumn();
