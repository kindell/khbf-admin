import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  try {
    const memberId = await question('Enter member ID: ');

    if (!memberId.trim()) {
      console.log('❌ Member ID required');
      return;
    }

    // Fetch existing mappings for this member
    const { data: existingMappings } = await supabase
      .from('email_mappings')
      .select('*')
      .eq('member_id', memberId);

    if (!existingMappings || existingMappings.length === 0) {
      console.log('ℹ️  No existing mappings found for this member');
    } else {
      console.log('\n📋 Existing mappings:');
      existingMappings.forEach((m, idx) => {
        console.log(`  ${idx + 1}. ${m.parakey_email} (${m.confidence}, created: ${m.created_at})`);
      });
    }

    const action = await question('\nWhat do you want to do? (delete/add/cancel): ');

    if (action.toLowerCase() === 'delete') {
      const emailToDelete = await question('Enter Parakey email to delete: ');

      const { error } = await supabase
        .from('email_mappings')
        .delete()
        .eq('member_id', memberId)
        .eq('parakey_email', emailToDelete);

      if (error) {
        console.error('❌ Error deleting mapping:', error.message);
      } else {
        console.log(`✅ Deleted mapping for ${emailToDelete}`);
      }
    } else if (action.toLowerCase() === 'add') {
      const parakeyEmail = await question('Enter Parakey email to add: ');

      const { error } = await supabase
        .from('email_mappings')
        .insert({
          member_id: memberId,
          parakey_email: parakeyEmail,
          confidence: 'MANUAL',
          verified: true,
          verified_by: 'script',
          verified_at: new Date().toISOString(),
          notes: `Manually added via fix-mapping.js script`
        });

      if (error) {
        console.error('❌ Error adding mapping:', error.message);
      } else {
        console.log(`✅ Added mapping for ${parakeyEmail}`);
      }
    } else {
      console.log('👋 Cancelled');
    }
  } finally {
    rl.close();
  }
}

main().catch(err => {
  console.error('Error:', err);
  rl.close();
  process.exit(1);
});
