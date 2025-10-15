import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function investigate() {
  const { data: members } = await supabase
    .from('members')
    .select('*')
    .in('fortnox_customer_number', ['1358', '1947'])
    .order('fortnox_customer_number');

  console.log('=== MEDLEMMAR ===\n');
  members.forEach(m => {
    console.log(`${m.fortnox_customer_number}: ${m.first_name} ${m.last_name}`);
    console.log(`  Status: ${m.status}`);
    console.log(`  Aptus ID: ${m.aptus_user_id}`);
    console.log(`  Parakey ID: ${m.parakey_user_id}`);
    console.log(`  Senaste årlig avgift: ${m.last_annual_fee_date}`);
    console.log(`  Senaste inträdesavgift: ${m.last_entrance_fee_date}`);
    console.log(`  Senaste köavgift: ${m.last_queue_fee_date}`);
    console.log('');
  });

  const parakeyIds = members.map(m => m.parakey_user_id).filter(Boolean);
  if (parakeyIds.length > 0) {
    const { data: parakeyUsers } = await supabase
      .from('parakey_users')
      .select('*')
      .in('id', parakeyIds);

    console.log('=== PARAKEY ANVÄNDARE ===\n');
    parakeyUsers.forEach(p => {
      const member = members.find(m => m.parakey_user_id === p.id);
      console.log(`${member.fortnox_customer_number}: ${p.name} (${p.email})`);
    });
    console.log('');
  }

  const memberIds = members.map(m => m.id).join(',');
  const { data: relations } = await supabase
    .from('member_relations')
    .select('*')
    .or(`primary_member_id.in.(${memberIds}),related_member_id.in.(${memberIds})`);

  console.log('=== RELATIONER ===\n');
  if (relations && relations.length > 0) {
    for (const rel of relations) {
      const primary = members.find(m => m.id === rel.primary_member_id);
      const related = members.find(m => m.id === rel.related_member_id);
      console.log(`${primary.fortnox_customer_number} → ${related.fortnox_customer_number}`);
      console.log(`  Typ: ${rel.relation_type}`);
      console.log(`  Skapad: ${rel.created_at}`);
    }
  } else {
    console.log('Inga relationer funna!');
  }
  console.log('');

  const { data: emailMappings } = await supabase
    .from('email_mappings')
    .select('*')
    .in('member_id', members.map(m => m.id));

  console.log('=== EMAIL MAPPINGS ===\n');
  if (emailMappings && emailMappings.length > 0) {
    emailMappings.forEach(em => {
      const member = members.find(m => m.id === em.member_id);
      console.log(`${member.fortnox_customer_number}: ${em.parakey_email}`);
    });
  }
}

investigate();
