import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkEventMemberId() {
  // Check if events with RFID 235214837 have member_id set
  const { data, error } = await supabase
    .from('events')
    .select('id, eventtime, userid, member_id, accesscredential, status')
    .eq('accesscredential', '235214837')
    .order('eventtime', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error:', error);
  } else if (data && data.length > 0) {
    console.log(`✅ Found ${data.length} event(s) with RFID 235214837:\n`);
    data.forEach(event => {
      console.log(`Event ID: ${event.id}`);
      console.log(`  Time: ${event.eventtime}`);
      console.log(`  User ID: ${event.userid || 'N/A'}`);
      console.log(`  Member ID: ${event.member_id || '❌ NOT SET'}`);
      console.log(`  Status: ${event.status}`);
      console.log('');
    });
  } else {
    console.log('❌ No events found with RFID 235214837');
  }

  process.exit(0);
}

checkEventMemberId();
