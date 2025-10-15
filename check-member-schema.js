import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const { data: member, error } = await supabase
  .from('members')
  .select('*')
  .eq('fortnox_customer_number', '1358')
  .single();

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

console.log('=== ALLA KOLUMNER I MEMBERS-TABELLEN ===\n');
console.log(Object.keys(member).sort().join('\n'));

console.log('\n=== DATA FÖR 1358 (Ewa) ===\n');
console.log(JSON.stringify(member, null, 2));
