import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const { data: syncState } = await supabase
  .from('sync_state')
  .select('*')
  .eq('sync_type', 'payment')
  .single();

console.log('=== PAYMENT SYNC STATE ===\n');
console.log(`Last sync: ${syncState?.last_sync_at || 'aldrig'}`);
console.log(`Details:`, syncState?.details);
