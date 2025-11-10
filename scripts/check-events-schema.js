import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkEventsSchema() {
  console.log('🔍 Checking events table schema...\n');

  // Get one event to see all columns
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
  } else if (data && data.length > 0) {
    console.log('📋 Events table columns:');
    Object.keys(data[0]).forEach(key => {
      console.log(`  - ${key}`);
    });
  } else {
    console.log('❌ No events found in table');
  }

  process.exit(0);
}

checkEventsSchema();
