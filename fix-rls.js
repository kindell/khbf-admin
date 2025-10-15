import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function fixRLS() {
  console.log('Testing direct SQL insert...');

  // Try using RPC or raw SQL
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      INSERT INTO sms_queue (direction, phone_number, message, status)
      VALUES ('outbound', '+46723939090', 'Test message', 'pending')
      RETURNING *;
    `
  });

  if (error) {
    console.error('RPC Error:', error);

    // Try disabling RLS temporarily
    console.log('\nTrying to check RLS status...');
    const { data: rlsData, error: rlsError } = await supabase
      .from('sms_queue')
      .select('*')
      .limit(0);

    console.log('RLS check:', { rlsData, rlsError });
  } else {
    console.log('Success:', data);
  }
}

fixRLS();
