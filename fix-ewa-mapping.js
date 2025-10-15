import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Get Ewa's member ID
const { data: ewa } = await supabase
  .from('members')
  .select('id, fortnox_customer_number, first_name, last_name')
  .eq('fortnox_customer_number', '1358')
  .single();

console.log(`Found member: ${ewa.fortnox_customer_number} - ${ewa.first_name} ${ewa.last_name}`);
console.log(`Member ID: ${ewa.id}\n`);

// Get all email mappings for Ewa
const { data: mappings } = await supabase
  .from('email_mappings')
  .select('*')
  .eq('member_id', ewa.id);

console.log('Current email mappings:');
mappings.forEach(m => {
  console.log(`  - ${m.parakey_email} (${m.notes})`);
});
console.log('');

// Delete the incorrect mapping (Jan's email)
const { data: deleted, error } = await supabase
  .from('email_mappings')
  .delete()
  .eq('member_id', ewa.id)
  .eq('parakey_email', 'redig57@gmail.com')
  .select();

if (error) {
  console.error('Error deleting mapping:', error);
  process.exit(1);
}

console.log('✅ Deleted incorrect mapping:');
console.log(`  - ${deleted[0].parakey_email} (${deleted[0].notes})`);
console.log('');

// Clear parakey_user_id from Ewa
const { error: updateError } = await supabase
  .from('members')
  .update({ parakey_user_id: null })
  .eq('id', ewa.id);

if (updateError) {
  console.error('Error updating member:', updateError);
  process.exit(1);
}

console.log('✅ Cleared parakey_user_id from Ewa');
console.log('');
console.log('Done! Ewa now only has her own email (ewa694@live.se) and no Parakey link.');
