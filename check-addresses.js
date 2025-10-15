import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const { data: members } = await supabase
  .from('members')
  .select('fortnox_customer_number, first_name, last_name, address, postal_code, city')
  .in('fortnox_customer_number', ['1358', '1947'])
  .order('fortnox_customer_number');

console.log('=== ADRESSER ===\n');
members.forEach(m => {
  console.log(`${m.fortnox_customer_number}: ${m.first_name} ${m.last_name}`);
  console.log(`  ${m.address}`);
  console.log(`  ${m.postal_code} ${m.city}`);
  console.log('');
});

if (members[0].address === members[1].address && 
    members[0].postal_code === members[1].postal_code) {
  console.log('✅ SAMMA ADRESS!');
  console.log('→ Systemet borde ha skapat en relation baserat på detta');
} else {
  console.log('❌ OLIKA ADRESSER');
  console.log(`Ewa: ${members[0].address}, ${members[0].postal_code}`);
  console.log(`Jan: ${members[1].address}, ${members[1].postal_code}`);
}
