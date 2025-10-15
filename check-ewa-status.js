import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const { data: ewa } = await supabase
  .from('members')
  .select('*')
  .eq('fortnox_customer_number', '1358')
  .single();

console.log('=== EWA (1358) STATUS ===\n');
console.log(`Status i DB: ${ewa.status}`);
console.log(`Last annual fee: ${ewa.last_annual_fee_date}`);
console.log(`Last entrance fee: ${ewa.last_entrance_fee_date}`);
console.log(`Last queue fee: ${ewa.last_queue_fee_date}`);
console.log(`Last visit: ${ewa.last_visit_at}`);
console.log('');

// Check invoices
const { data: invoices } = await supabase
  .from('invoices')
  .select('*')
  .eq('fortnox_customer_number', '1358')
  .order('invoice_date', { ascending: false })
  .limit(5);

console.log('=== SENASTE FAKTUROR ===\n');
invoices.forEach(inv => {
  const paid = inv.booked ? 'JA' : 'NEJ';
  console.log(`${inv.invoice_date}: ${inv.description} - ${inv.total} kr (Betald: ${paid})`);
});
console.log('');

// Check what payment-sync would calculate
const now = new Date();
const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

const hasRecentAnnualFee = ewa.last_annual_fee_date && new Date(ewa.last_annual_fee_date) > oneYearAgo;
const hasRecentEntranceFee = ewa.last_entrance_fee_date && new Date(ewa.last_entrance_fee_date) > oneYearAgo;
const hasRecentQueueFee = ewa.last_queue_fee_date && new Date(ewa.last_queue_fee_date) > oneYearAgo;

console.log('=== BETALNINGSANALYS ===\n');
console.log(`Årlig avgift senaste året: ${hasRecentAnnualFee ? 'JA' : 'NEJ'} (${ewa.last_annual_fee_date || 'aldrig'})`);
console.log(`Inträdesavgift senaste året: ${hasRecentEntranceFee ? 'JA' : 'NEJ'} (${ewa.last_entrance_fee_date || 'aldrig'})`);
console.log(`Köavgift senaste året: ${hasRecentQueueFee ? 'JA' : 'NEJ'} (${ewa.last_queue_fee_date || 'aldrig'})`);
console.log('');
console.log('BERÄKNAD STATUS:');
if (hasRecentAnnualFee || hasRecentEntranceFee) {
  console.log('→ MEDLEM (har betalat årlig eller inträdesavgift)');
} else if (hasRecentQueueFee) {
  console.log('→ KÖANDE (har betalat köavgift)');
} else {
  console.log('→ INAKTIV (ingen betalning senaste året)');
}
