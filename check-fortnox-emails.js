import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const { data: members, error } = await supabase
  .from('members')
  .select('fortnox_customer_number, first_name, last_name, email, invoice_email')
  .in('fortnox_customer_number', ['1358', '1947'])
  .order('fortnox_customer_number');

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

if (!members || members.length === 0) {
  console.log('No members found');
  process.exit(1);
}

console.log('=== EMAIL DATA FRÅN FORTNOX ===\n');
members.forEach(m => {
  console.log(`${m.fortnox_customer_number}: ${m.first_name} ${m.last_name}`);
  console.log(`  email: ${m.email || '(saknas)'}`);
  console.log(`  invoice_email: ${m.invoice_email || '(saknas)'}`);
  console.log('');
});

console.log('=== ANALYS ===\n');
console.log('member-sync.js skapar email_mappings från BÅDA fälten:');
console.log('1. Om "email" finns → skapar mapping med confidence=HIGH');
console.log('2. Om "invoice_email" finns OCH skiljer sig från email → skapar EXTRA mapping\n');

const ewa = members.find(m => m.fortnox_customer_number === '1358');
const jan = members.find(m => m.fortnox_customer_number === '1947');

if (ewa && jan && (ewa.invoice_email === jan.email || ewa.invoice_email === jan.invoice_email)) {
  console.log('⚠️  HITTADE PROBLEMET:');
  console.log(`   Ewa har invoice_email="${ewa.invoice_email}"`);
  console.log('   Detta är Jans email!');
  console.log('   → member-sync skapar därför felaktig email_mapping för Ewa');
  console.log('   → Detta gör att Ewa får Jans parakey_user_id');
}
