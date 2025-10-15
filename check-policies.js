import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkPolicies() {
  // Try to insert a test SMS to see the exact error
  const { data, error } = await supabase
    .from('sms_queue')
    .insert({
      direction: 'outbound',
      phone_number: '+46723939090',
      message: 'Test message',
      status: 'pending'
    })
    .select();

  if (error) {
    console.error('Error inserting into sms_queue:', error);
  } else {
    console.log('Successfully inserted:', data);
  }
}

checkPolicies();
