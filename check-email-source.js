import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Get both members
const { data: members } = await supabase
  .from('members')
  .select('*')
  .in('fortnox_customer_number', ['1358', '1947'])
  .order('fortnox_customer_number');

console.log('=== MEDLEMMAR ===\n');
members.forEach(m => {
  console.log(`${m.fortnox_customer_number}: ${m.first_name} ${m.last_name}`);
  console.log(`  email: ${m.email}`);
  console.log(`  parakey_user_id: ${m.parakey_user_id}`);
  console.log('');
});

// Get email mappings for both
const { data: mappings } = await supabase
  .from('email_mappings')
  .select('*')
  .in('member_id', members.map(m => m.id))
  .order('member_id');

console.log('=== EMAIL_MAPPINGS ===\n');
for (const map of mappings) {
  const member = members.find(m => m.id === map.member_id);
  console.log(`${member.fortnox_customer_number} (${member.first_name}):`);
  console.log(`  parakey_email: ${map.parakey_email}`);
  console.log(`  confidence: ${map.confidence}`);
  console.log(`  notes: ${map.notes}`);
  console.log(`  created: ${map.created_at}`);
  console.log('');
}

// Get the Parakey user
const { data: parakeyUser } = await supabase
  .from('parakey_users')
  .select('*')
  .eq('id', 'THC6P98RmM')
  .single();

console.log('=== PARAKEY USER (THC6P98RmM) ===\n');
console.log(`Namn: ${parakeyUser.name}`);
console.log(`Email: ${parakeyUser.email}`);
