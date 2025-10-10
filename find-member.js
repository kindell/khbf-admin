import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const searchName = process.argv[2];

if (!searchName) {
  console.log('Usage: node find-member.js "Name"');
  process.exit(1);
}

const { data: members } = await supabase
  .from('members')
  .select('id, fortnox_customer_number, first_name, last_name, email')
  .or(`first_name.ilike.%${searchName}%,last_name.ilike.%${searchName}%`);

if (!members || members.length === 0) {
  console.log('❌ No members found');
} else {
  console.log(`Found ${members.length} member(s):\n`);
  members.forEach(m => {
    console.log(`ID: ${m.id}`);
    console.log(`Name: ${m.first_name} ${m.last_name}`);
    console.log(`Email: ${m.email || '-'}`);
    console.log(`Customer#: ${m.fortnox_customer_number}`);
    console.log('---');
  });
}
