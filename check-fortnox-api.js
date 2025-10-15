import dotenv from 'dotenv';
dotenv.config({ path: '../khbf-sync/fortnox/.env' });

async function checkFortnoxCustomer(customerNumber) {
  const response = await fetch(`https://api.fortnox.se/3/customers/${customerNumber}`, {
    headers: {
      'Access-Token': process.env.FORTNOX_ACCESS_TOKEN,
      'Client-Secret': process.env.FORTNOX_CLIENT_SECRET,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    console.error(`Error ${response.status}: ${response.statusText}`);
    const text = await response.text();
    console.error(text);
    return null;
  }
  
  const data = await response.json();
  return data.Customer;
}

console.log('=== FORTNOX DATA ===\n');

const ewa = await checkFortnoxCustomer('1358');
if (ewa) {
  console.log('1358 (Ewa Redig):');
  console.log(`  Email: ${ewa.Email || '(saknas)'}`);
  console.log(`  EmailInvoice: ${ewa.EmailInvoice || '(saknas)'}`);
  console.log(`  EmailOrder: ${ewa.EmailOrder || '(saknas)'}`);
  console.log(`  EmailOffer: ${ewa.EmailOffer || '(saknas)'}`);
  console.log('');
}

const jan = await checkFortnoxCustomer('1947');
if (jan) {
  console.log('1947 (Jan Redig):');
  console.log(`  Email: ${jan.Email || '(saknas)'}`);
  console.log(`  EmailInvoice: ${jan.EmailInvoice || '(saknas)'}`);
  console.log(`  EmailOrder: ${jan.EmailOrder || '(saknas)'}`);
  console.log(`  EmailOffer: ${jan.EmailOffer || '(saknas)'}`);
  console.log('');
}

if (ewa && jan) {
  console.log('=== ANALYS ===\n');
  if (ewa.EmailInvoice === jan.Email || ewa.EmailInvoice === jan.EmailInvoice) {
    console.log('⚠️  HITTADE ORSAKEN:');
    console.log(`   Ewas EmailInvoice i Fortnox = "${ewa.EmailInvoice}"`);
    console.log(`   Detta är Jans email!`);
    console.log('');
    console.log('Flöde:');
    console.log('1. member-sync.js hämtar EmailInvoice från Fortnox');
    console.log('2. Skapar email_mapping: Ewa → redig57@gmail.com');
    console.log('3. link-parakey-users.js hittar att redig57@gmail.com finns i parakey_users');
    console.log('4. Länkar Ewa till Jans parakey_user_id (THC6P98RmM)');
    console.log('');
    console.log('Lösning: Ta bort EmailInvoice från Fortnox för Ewa, eller ignorera EmailInvoice i sync-logiken');
  }
}
