import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkInvoices() {
  // Total invoices
  const { count: totalCount, error: countError } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error counting invoices:', countError);
    return;
  }

  console.log(`📊 Total invoices: ${totalCount}`);

  // Check Lennart's invoices
  const { data: lennartInvoices, error: lennartError } = await supabase
    .from('invoices')
    .select('*')
    .eq('fortnox_customer_number', '2031');

  if (lennartError) {
    console.error('❌ Error fetching Lennart invoices:', lennartError);
    return;
  }

  console.log(`\n👤 Lennart (2031) has ${lennartInvoices.length} invoices:`);
  lennartInvoices.forEach(inv => {
    console.log(`  - ${inv.fortnox_invoice_number}: ${inv.invoice_date}, ${inv.total} ${inv.currency}`);
  });

  // Sample of invoices with hash
  const { data: sampleInvoices, error: sampleError } = await supabase
    .from('invoices')
    .select('fortnox_invoice_number, content_hash, synced_at')
    .not('content_hash', 'is', null)
    .limit(5);

  if (!sampleError && sampleInvoices) {
    console.log(`\n🔍 Sample invoices with hash:`);
    sampleInvoices.forEach(inv => {
      console.log(`  - ${inv.fortnox_invoice_number}: ${inv.content_hash.substring(0, 8)}... (synced: ${inv.synced_at})`);
    });
  }
}

checkInvoices();
