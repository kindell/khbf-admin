import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkMikaelMember() {
  // Search for Mikael K Karlsson by name
  const { data: mikaelData, error: mikaelError } = await supabase
    .from('members')
    .select('id, first_name, last_name, aptus_user_id, fortnox_customer_number')
    .ilike('first_name', '%Mikael%')
    .ilike('last_name', '%Karlsson%');

  if (mikaelError) {
    console.error('❌ Error searching for Mikael:', mikaelError);
  } else if (mikaelData && mikaelData.length > 0) {
    console.log('📋 Found Mikael Karlsson members:\n');
    mikaelData.forEach(member => {
      console.log(`ID: ${member.id}`);
      console.log(`  Name: ${member.first_name} ${member.last_name}`);
      console.log(`  fortnox_customer_number: ${member.fortnox_customer_number || 'NULL'}`);
      console.log(`  aptus_user_id: ${member.aptus_user_id || 'NULL'}`);
      console.log('');
    });

    // Check if fortnox_customer_number matches f0 value 1634
    console.log('\n🔍 Aptus f0 value is 1634 - does it match?');
    const match = mikaelData.find(m => m.fortnox_customer_number === '1634');
    if (match) {
      console.log(`✅ YES! ${match.first_name} ${match.last_name} has fortnox_customer_number = 1634`);
    } else {
      console.log('❌ NO - fortnox_customer_number does not match f0 value');
    }
  } else {
    console.log('❌ No Mikael Karlsson found in members table');
  }

  process.exit(0);
}

checkMikaelMember();
