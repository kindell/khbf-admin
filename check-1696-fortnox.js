import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Read from khbf-sync fortnox directory
const FORTNOX_ACCESS_TOKEN = process.env.FORTNOX_ACCESS_TOKEN;
const FORTNOX_CLIENT_SECRET = process.env.FORTNOX_CLIENT_SECRET;

console.log('🔍 Fetching customer 1696 from Fortnox...\n');

// First try to get token from khbf-sync
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to read from khbf-sync directory
let tokenData;
try {
  const tokenPath = join(__dirname, '../khbf-sync/fortnox/.tokens');
  tokenData = JSON.parse(readFileSync(tokenPath, 'utf8'));
  console.log('✅ Found tokens from khbf-sync');
} catch (err) {
  console.log('❌ Could not read tokens from khbf-sync:', err.message);
  process.exit(1);
}

const accessToken = tokenData.access_token;

// Fetch from Fortnox API
const response = await fetch('https://api.fortnox.se/3/customers/1696', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Client-Secret': FORTNOX_CLIENT_SECRET || tokenData.client_secret,
    'Content-Type': 'application/json'
  }
});

if (!response.ok) {
  console.error('❌ Fortnox API error:', response.status, response.statusText);
  const text = await response.text();
  console.error('Response:', text);
  process.exit(1);
}

const data = await response.json();
const customer = data.Customer;

console.log('👤 Customer Info from Fortnox:');
console.log('  Customer Number:', customer.CustomerNumber);
console.log('  Name:', customer.Name);
console.log('  Email:', customer.Email);
console.log('  Phone:', customer.Phone);
console.log('  Mobile:', customer.Phone2);
console.log('');

console.log('📍 Address:');
console.log('  Address:', customer.Address1);
console.log('  Address 2:', customer.Address2);
console.log('  Zip:', customer.ZipCode);
console.log('  City:', customer.City);
console.log('');

console.log('📊 Status & Type:');
console.log('  Active:', customer.Active);
console.log('  Type:', customer.Type);
console.log('  Customer Category:', customer.CustomerCategory);
console.log('');

console.log('💳 Payment Info:');
console.log('  Terms of Payment:', customer.TermsOfPayment);
console.log('  Way of Delivery:', customer.WayOfDelivery);
console.log('  Invoice Delivery Method:', customer.DefaultDeliveryTypes?.Invoice);
console.log('');

console.log('📝 Custom Fields (comments):');
console.log('  Comments:', customer.Comments);
console.log('  Delivery Address 1:', customer.DeliveryAddress1);
console.log('  Delivery Address 2:', customer.DeliveryAddress2);
console.log('');

// Check if has KÖANDE marker
const hasKöande = customer.Comments?.includes('KÖANDE') ||
                   customer.Comments?.includes('köande') ||
                   customer.Comments?.includes('kö');

console.log('🤔 Analysis:');
console.log('  Has "KÖANDE" marker in comments:', hasKöande ? 'YES' : 'NO');
console.log('  Active in Fortnox:', customer.Active ? 'YES' : 'NO');
console.log('');

if (!hasKöande && customer.Active) {
  console.log('⚠️  Customer is marked as ACTIVE in Fortnox with no KÖANDE marker');
  console.log('    But never paid according to our database.');
  console.log('    This person might need to be set to KÖANDE status.');
}
