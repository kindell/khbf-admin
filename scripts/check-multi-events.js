import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkMultiEvents() {
  // Get all events with userid='null' to check what we have
  const { data, error } = await supabase
    .from('events')
    .select('id, eventtime, userid, username, eventtype, rawjson')
    .eq('userid', 'null')
    .order('eventtime', { ascending: false });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`Total events with userid='null': ${data.length}`);

  // Check ActivatorName from rawjson
  const multiEvents = data.filter(e => {
    if (!e.rawjson) return false;
    const raw = JSON.parse(e.rawjson);
    return raw.ActivatorName === 'Multi';
  });

  console.log(`Events with ActivatorName='Multi': ${multiEvents.length}`);

  // Show breakdown by username
  const byUsername = {};
  multiEvents.forEach(e => {
    byUsername[e.username] = (byUsername[e.username] || 0) + 1;
  });

  console.log('');
  console.log('Breakdown by username:');
  Object.entries(byUsername).forEach(([username, count]) => {
    console.log(`  ${username}: ${count}`);
  });

  console.log('');
  console.log('Sample events:');
  multiEvents.slice(0, 5).forEach(e => {
    const raw = JSON.parse(e.rawjson);
    console.log(`  Time: ${e.eventtime}, Username: ${e.username}, Name: ${raw.Name}`);
  });

  process.exit(0);
}

checkMultiEvents();
