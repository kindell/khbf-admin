import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const memberId = process.argv[2];
const parakeyEmail = process.argv[3];

if (!memberId || !parakeyEmail) {
  console.log('Usage: node delete-mapping.js <member_id> <parakey_email>');
  process.exit(1);
}

const { error } = await supabase
  .from('email_mappings')
  .delete()
  .eq('member_id', memberId)
  .eq('parakey_email', parakeyEmail);

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

console.log(`✅ Deleted mapping: ${parakeyEmail} for member ${memberId}`);
