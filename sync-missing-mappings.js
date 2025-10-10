import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

console.log('Söker efter medlemmar med parakey_user_id men utan email_mappings...\n');

// Hämta alla medlemmar med parakey_user_id
const { data: membersWithParakey } = await supabase
  .from('members')
  .select('id, first_name, last_name, fortnox_customer_number, parakey_user_id')
  .not('parakey_user_id', 'is', null);

console.log(`Hittade ${membersWithParakey.length} medlemmar med Parakey-access\n`);

let created = 0;
let skipped = 0;
let errors = 0;

for (const member of membersWithParakey) {
  // Hämta Parakey-användarens email
  const { data: parakeyUser } = await supabase
    .from('parakey_users')
    .select('email')
    .eq('id', member.parakey_user_id)
    .single();

  if (!parakeyUser) {
    console.log(`⚠️  ${member.first_name} ${member.last_name} - kunde inte hitta Parakey-användare`);
    errors++;
    continue;
  }

  // Kolla om mappning redan finns
  const { data: existingMapping } = await supabase
    .from('email_mappings')
    .select('id')
    .eq('member_id', member.id)
    .eq('parakey_email', parakeyUser.email)
    .single();

  if (existingMapping) {
    console.log(`⏭️  ${member.first_name} ${member.last_name} - mappning finns redan`);
    skipped++;
    continue;
  }

  // Skapa mappning
  const { error } = await supabase
    .from('email_mappings')
    .insert({
      member_id: member.id,
      parakey_email: parakeyUser.email,
      confidence: 'MANUAL',
      verified: true,
      verified_by: 'sync-script',
      verified_at: new Date().toISOString(),
      notes: `Auto-created from existing parakey_user_id link`
    });

  if (error) {
    console.log(`❌ ${member.first_name} ${member.last_name} - fel: ${error.message}`);
    errors++;
  } else {
    console.log(`✅ ${member.first_name} ${member.last_name} (${member.fortnox_customer_number}) → ${parakeyUser.email}`);
    created++;
  }
}

console.log(`\n📊 Sammanfattning:`);
console.log(`   Skapade: ${created}`);
console.log(`   Hoppade över: ${skipped}`);
console.log(`   Fel: ${errors}`);
