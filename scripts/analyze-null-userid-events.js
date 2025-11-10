import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function analyzeNullUseridEvents() {
  // Get all events with userid='null'
  const { data, error } = await supabase
    .from('events')
    .select('id, eventtime, userid, username, eventtype, status, rawjson')
    .eq('userid', 'null')
    .order('eventtime', { ascending: false });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`Total events with userid='null': ${data.length}`);
  console.log('');

  // Breakdown by ActivatorName
  const byActivatorName = {};
  data.forEach(e => {
    if (e.rawjson) {
      const raw = JSON.parse(e.rawjson);
      const name = raw.ActivatorName || 'N/A';
      byActivatorName[name] = (byActivatorName[name] || 0) + 1;
    }
  });

  console.log('Breakdown by ActivatorName:');
  Object.entries(byActivatorName)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      console.log(`  ${name}: ${count}`);
    });

  console.log('');

  // Breakdown by status
  const byStatus = {};
  data.forEach(e => {
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;
  });

  console.log('Breakdown by status:');
  Object.entries(byStatus)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

  console.log('');

  // Sample of non-Multi events
  const nonMulti = data.filter(e => {
    if (!e.rawjson) return true;
    const raw = JSON.parse(e.rawjson);
    return raw.ActivatorName !== 'Multi';
  });

  console.log('Sample of non-Multi events (first 5):');
  nonMulti.slice(0, 5).forEach(e => {
    const raw = e.rawjson ? JSON.parse(e.rawjson) : {};
    console.log(`  ${e.eventtime} | ${e.username} | ${raw.ActivatorName || 'N/A'} | ${e.status}`);
  });

  process.exit(0);
}

analyzeNullUseridEvents();
