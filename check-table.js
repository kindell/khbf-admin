import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkTable() {
  // Get a sample row to see the structure
  const { data, error } = await supabase
    .from('sms_queue')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Sample row from sms_queue:');
    console.log(JSON.stringify(data[0], null, 2));
  }
}

checkTable();
