import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const { data, error } = await supabase
  .from('members')
  .select('id, fortnox_customer_number, first_name, last_name, status')
  .eq('fortnox_customer_number', '2031')
  .single();

console.log('Member 2031 in database:');
console.log(data);
