import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function getLatestOTP() {
  const { data, error } = await supabase
    .from('sms_auth_codes')
    .select('code, phone_number, created_at, expires_at')
    .eq('phone_number', '+46723939090')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Latest OTP code:', data[0].code);
    console.log('Created:', data[0].created_at);
    console.log('Expires:', data[0].expires_at);
  } else {
    console.log('No OTP code found');
  }
}

getLatestOTP();
