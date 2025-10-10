import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const parakeyEmails = [
  'uu@2usports.com',
  'yoga.anahata.uta@gmail.com',
  'jens.bengtstrom@callidus.se',
  'andreas.glyssbo@capgemini.com',
  'leif.danielsson@ldconsult.se',
  'maria.hildell@origogroup.com'
];

console.log('Söker efter medlemmar med matchande emails...\n');

for (const email of parakeyEmails) {
  const { data: member } = await supabase
    .from('members')
    .select('id, fortnox_customer_number, first_name, last_name, email')
    .ilike('email', email)
    .single();

  if (member) {
    console.log(`✅ ${email}`);
    console.log(`   → ${member.first_name} ${member.last_name} (${member.fortnox_customer_number})`);
    console.log(`   ID: ${member.id}\n`);
  } else {
    console.log(`❌ ${email} - ingen matchande medlem\n`);
  }
}
