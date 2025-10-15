import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const { data: member } = await supabase
  .from('members')
  .select('id, fortnox_customer_number, first_name, last_name, status, last_annual_fee_date, last_visit_at, aptus_user_id, parakey_user_id')
  .eq('fortnox_customer_number', '2031')
  .single();

console.log('Lennart:');
console.log('  Status in DB:', member.status);
console.log('  Last annual fee:', member.last_annual_fee_date);
console.log('  Last visit:', member.last_visit_at);
console.log('  Aptus ID:', member.aptus_user_id);
console.log('  Parakey ID:', member.parakey_user_id);

if (member.last_visit_at) {
  const threeMonthsAgo = new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000);
  const lastVisit = new Date(member.last_visit_at);
  console.log('\n  3 months ago:', threeMonthsAgo.toISOString().split('T')[0]);
  console.log('  Last visit was:', lastVisit > threeMonthsAgo ? 'RECENT (< 3 months)' : 'OLD (> 3 months)');
  console.log('\n  → Category:', lastVisit > threeMonthsAgo ? 'MEDLEM' : 'SPONSOR');
} else {
  console.log('\n  No visits recorded → Category: SPONSOR');
}
