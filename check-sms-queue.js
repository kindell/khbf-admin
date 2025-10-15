import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkQueue() {
  const { data, error } = await supabase
    .from('sms_queue')
    .select('*')
    .eq('phone_number', '+46723939090')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Senaste SMS i kön:');
    console.log('- Meddelande:', data[0].message.substring(0, 50) + '...');
    console.log('- Status:', data[0].status);
    console.log('- Skapad:', data[0].created_at);
    console.log('- Thread ID:', data[0].thread_id);
  }
}

checkQueue();
