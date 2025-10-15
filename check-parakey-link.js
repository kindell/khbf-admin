import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  // Check parakey_users table
  const { data: parakeyUser } = await supabase
    .from('parakey_users')
    .select('*')
    .eq('id', 'THC6P98RmM')
    .single();

  console.log('=== PARAKEY_USERS TABELL ===\n');
  console.log(`ID: ${parakeyUser.id}`);
  console.log(`Namn: ${parakeyUser.name}`);
  console.log(`Email: ${parakeyUser.email}`);
  console.log('');

  // Check which members are linked to this parakey
  const { data: members } = await supabase
    .from('members')
    .select('fortnox_customer_number, first_name, last_name, email, parakey_user_id')
    .eq('parakey_user_id', 'THC6P98RmM');

  console.log('=== MEDLEMMAR MED DENNA PARAKEY_USER_ID ===\n');
  members.forEach(m => {
    console.log(`${m.fortnox_customer_number}: ${m.first_name} ${m.last_name}`);
    console.log(`  Email i members: ${m.email}`);
  });
  console.log('');

  // Check email_mappings to see how the link was made
  const { data: mappings } = await supabase
    .from('email_mappings')
    .select('*')
    .in('member_id', members.map(m => `(SELECT id FROM members WHERE fortnox_customer_number = '${m.fortnox_customer_number}')`));

  // Get actual mappings
  const { data: allMappings } = await supabase
    .from('email_mappings')
    .select('member_id, parakey_email')
    .eq('parakey_email', 'redig57@gmail.com');

  console.log('=== EMAIL_MAPPINGS FÖR redig57@gmail.com ===\n');
  for (const map of allMappings) {
    const { data: member } = await supabase
      .from('members')
      .select('fortnox_customer_number, first_name, last_name')
      .eq('id', map.member_id)
      .single();
    
    console.log(`${member.fortnox_customer_number}: ${member.first_name} ${member.last_name} → redig57@gmail.com`);
  }
}

check();
