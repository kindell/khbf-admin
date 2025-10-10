import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '../khbf-sync/fortnox/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLeif() {
  // Get Leif's member record
  const { data: member } = await supabase
    .from('members')
    .select('id, name, customer_number, aptus_user_id')
    .eq('name', 'Danielsson Leif')
    .single();
    
  console.log('Leif member record:', member);
  
  // Get all aptus_users records for this customer_number
  if (member?.customer_number) {
    const { data: aptusCards } = await supabase
      .from('aptus_users')
      .select('*')
      .eq('f0', member.customer_number);
      
    console.log('\nAptus cards for customer_number', member.customer_number + ':', aptusCards);
  }
  
  // Get visits for this aptus_user_id
  if (member?.aptus_user_id) {
    const { data: visits } = await supabase
      .from('visits')
      .select('accesscredential')
      .eq('userid', member.aptus_user_id)
      .not('accesscredential', 'is', null)
      .limit(10);
      
    console.log('\nVisits for aptus_user_id', member.aptus_user_id + ':', visits);
  }
}

checkLeif().catch(console.error);
