import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const { data: members } = await supabase
  .from('members')
  .select('id, fortnox_customer_number, first_name, last_name')
  .in('fortnox_customer_number', ['1358', '1947']);

console.log('Member IDs:');
members.forEach(m => console.log(`  ${m.fortnox_customer_number}: ${m.id}`));
console.log('');

const { data: relations, error } = await supabase
  .from('member_relations')
  .select('*');

if (error) {
  console.error('Error:', error);
} else {
  console.log(`Total relations in DB: ${relations.length}`);
  
  const ewaJanRelations = relations.filter(r => {
    const memberIds = members.map(m => m.id);
    return memberIds.includes(r.medbadare_member_id) || 
           memberIds.includes(r.primary_member_id);
  });
  
  console.log(`Relations involving Ewa or Jan: ${ewaJanRelations.length}`);
  ewaJanRelations.forEach(r => {
    console.log('  ', r);
  });
}
