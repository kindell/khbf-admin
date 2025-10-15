import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function findUnlinked() {
  // Look for Aptus users with "Lennart" or "Wiberg" in name
  const { data: aptusUsers } = await supabase
    .from('aptus_users')
    .select('*')
    .or('name.ilike.%Lennart%,name.ilike.%Wiberg%');
  
  console.log('Aptus users matching Lennart/Wiberg:', aptusUsers?.length || 0);
  if (aptusUsers && aptusUsers.length > 0) {
    aptusUsers.forEach(user => {
      console.log(`  - ${user.name} (card: ${user.card}, f0: ${user.f0})`);
    });
  }
  
  // Look for Parakey users with "Lennart" or "Wiberg"
  const { data: parakeyUsers } = await supabase
    .from('parakey_users')
    .select('*')
    .or('name.ilike.%Lennart%,name.ilike.%Wiberg%,email.ilike.%lennart%,email.ilike.%wiberg%');
  
  console.log('\nParakey users matching Lennart/Wiberg:', parakeyUsers?.length || 0);
  if (parakeyUsers && parakeyUsers.length > 0) {
    parakeyUsers.forEach(user => {
      console.log(`  - ${user.name} (email: ${user.email})`);
    });
  }
  
  // Check if f0 field in aptus_users might have customer number
  const { data: aptusWithF0 } = await supabase
    .from('aptus_users')
    .select('*')
    .eq('f0', '2031');
  
  console.log('\nAptus users with f0=2031:', aptusWithF0?.length || 0);
  if (aptusWithF0 && aptusWithF0.length > 0) {
    aptusWithF0.forEach(user => {
      console.log(`  - ${user.name} (card: ${user.card})`);
    });
  }
}

findUnlinked();
