import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  const sql = fs.readFileSync('/Users/jon/Projects/khbf-sync/sms/migrations/007_fix_thread_trigger.sql', 'utf8');

  console.log('Running migration to fix thread trigger...\n');

  // Split by ; and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (const statement of statements) {
    console.log('Executing:', statement.substring(0, 100) + '...');

    const { data, error } = await supabase.rpc('exec_sql', {
      query: statement
    });

    if (error) {
      console.error('Error:', error);
      // Try alternative method
      console.log('Trying direct execution...');
      const response = await fetch(
        `${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/exec`,
        {
          method: 'POST',
          headers: {
            'apikey': process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${process.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: statement })
        }
      );
      console.log('Response:', await response.text());
    } else {
      console.log('Success!\n');
    }
  }

  console.log('\nMigration complete. Testing insert...');

  // Test insert
  const { data, error } = await supabase
    .from('sms_queue')
    .insert({
      direction: 'outbound',
      phone_number: '+46723939090',
      message: 'Test efter migration fix',
      status: 'pending'
    })
    .select();

  if (error) {
    console.error('Test insert failed:', error);
  } else {
    console.log('Test insert SUCCESS!', data);
  }
}

runMigration();
