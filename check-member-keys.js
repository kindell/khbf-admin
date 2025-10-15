import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkMemberKeys() {
  const { data: member, error } = await supabase
    .from('members')
    .select('id, fortnox_customer_number, first_name, last_name, aptus_user_id, parakey_user_id, status')
    .eq('fortnox_customer_number', '2031')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Member:', member);
  
  if (member.aptus_user_id) {
    const { data: aptusKeys } = await supabase
      .from('aptus_users')
      .select('*')
      .eq('id', member.aptus_user_id);
    console.log('\nAptus keys:', aptusKeys);
  } else {
    console.log('\nNo aptus_user_id');
  }
  
  if (member.parakey_user_id) {
    const { data: parakeyUser } = await supabase
      .from('parakey_users')
      .select('*')
      .eq('id', member.parakey_user_id);
    console.log('\nParakey user:', parakeyUser);
  } else {
    console.log('\nNo parakey_user_id');
  }
}

checkMemberKeys();
