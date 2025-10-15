import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function findMember() {
  const { data, error } = await supabase
    .from('members')
    .select('id, fortnox_customer_number, first_name, last_name, phone_mappings!inner(phone_number, is_primary)')
    .eq('fortnox_customer_number', 1505)
    .eq('phone_mappings.is_primary', true)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data) {
    console.log('Medlem 1505:', data.first_name, data.last_name);
    console.log('Telefon:', data.phone_mappings[0]?.phone_number);
  }
}

findMember();
