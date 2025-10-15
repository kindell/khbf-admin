import { getMemberCategory } from './src/lib/member-categories.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const { data: ewa } = await supabase
  .from('members')
  .select('*')
  .eq('fortnox_customer_number', '1358')
  .single();

console.log('=== EWA (1358) ===');
console.log(`Status i DB: ${ewa.status}`);
console.log(`Beräknad kategori: ${getMemberCategory(ewa)}`);
console.log('');
console.log('Detaljer:');
console.log(`  Last annual fee: ${ewa.last_annual_fee_date}`);
console.log(`  Last visit: ${ewa.last_visit_at}`);
console.log(`  Visits last 3 months: ${ewa.visits_last_3_months}`);

// Check for relation
const { data: relations } = await supabase
  .from('member_relations')
  .select('*, primary_member:members!member_relations_primary_member_id_fkey(fortnox_customer_number, first_name, last_name)')
  .eq('medbadare_member_id', ewa.id);

console.log('');
if (relations && relations.length > 0) {
  console.log('Relation hittad:');
  relations.forEach(r => {
    console.log(`  → ${r.primary_member.fortnox_customer_number}: ${r.primary_member.first_name} ${r.primary_member.last_name}`);
    console.log(`     Typ: ${r.relation_type}, Confidence: ${r.confidence}`);
  });
} else {
  console.log('Ingen relation hittad');
}
