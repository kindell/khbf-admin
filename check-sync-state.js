import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSyncState() {
  const { data, error } = await supabase
    .from('sync_state')
    .select('*')
    .order('last_sync_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching sync_state:', error);
    return;
  }

  console.log('📊 Sync State Table:\n');
  data.forEach(state => {
    console.log(`  ${state.sync_type}:`);
    console.log(`    Last sync: ${state.last_sync_at}`);
    if (state.details) {
      console.log(`    Details:`, JSON.stringify(state.details, null, 2));
    }
    console.log('');
  });
}

checkSyncState();
