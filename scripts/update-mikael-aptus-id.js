import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function updateMikaelAptusId() {
  // Update Mikael K Karlsson's aptus_user_id from 707 to 723 (the new key)
  const { data, error } = await supabase
    .from('members')
    .update({ aptus_user_id: '723' })
    .eq('id', '41e0165b-6ba6-4d37-9547-697f9a9cd084')
    .select();

  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Updated Mikael K Karlsson:');
    console.log(data);
  }

  process.exit(0);
}

updateMikaelAptusId();
