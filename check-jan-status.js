import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const { data: jan } = await supabase
  .from('members')
  .select('*')
  .eq('fortnox_customer_number', '1947')
  .single();

console.log('=== JAN (1947) STATUS ===\n');
console.log(`Status i DB: ${jan.status}`);
console.log(`Last annual fee: ${jan.last_annual_fee_date}`);
console.log(`Last entrance fee: ${jan.last_entrance_fee_date}`);
console.log(`Last queue fee: ${jan.last_queue_fee_date}`);
console.log(`Last visit: ${jan.last_visit_at}`);
console.log('');

// Check invoices
const { data: invoices } = await supabase
  .from('invoices')
  .select('*')
  .eq('fortnox_customer_number', '1947')
  .order('invoice_date', { ascending: false })
  .limit(5);

console.log('=== SENASTE FAKTUROR ===\n');
invoices.forEach(inv => {
  const paid = inv.booked ? 'JA' : 'NEJ';
  console.log(`${inv.invoice_date}: ${inv.description || inv.article_description || '(ingen beskrivning)'} - ${inv.total} kr (Betald: ${paid})`);
});
