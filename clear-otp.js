import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function clearOTP() {
  const { data, error } = await supabase
    .from('sms_auth_codes')
    .delete()
    .eq('phone_number', '+46723939090');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Cleared OTP codes for +46723939090');
}

clearOTP();
