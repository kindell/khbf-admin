import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rzsoxgagglmitglvmfrk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6c294Z2FnZ2xtaXRnbHZtZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNDAzMDMsImV4cCI6MjA2OTkxNjMwM30.npjmuW_oOVnn9x27s1GtRu0knc-IWwxxHzQwZs7f3cc'
);

console.log('🔍 Analyzing member 1696...\n');

// Fetch member data
const { data: member, error } = await supabase
  .from('members')
  .select('*')
  .eq('fortnox_customer_number', '1696')
  .single();

if (error) {
  console.error('❌ Error fetching member:', error);
  process.exit(1);
}

console.log('👤 Member Info:');
console.log('  Name:', member.first_name, member.last_name);
console.log('  Email:', member.email);
console.log('  Status:', member.status);
console.log('  Customer #:', member.fortnox_customer_number);
console.log('  Is system account:', member.is_system_account);
console.log('');

console.log('💳 Payment History:');
console.log('  Last annual fee:', member.last_annual_fee_date || 'NEVER');
console.log('  Last entrance fee:', member.last_entrance_fee_date || 'NEVER');
console.log('');

console.log('🔑 Access Methods:');
console.log('  Aptus user ID:', member.aptus_user_id || 'NONE');
console.log('  Parakey user ID:', member.parakey_user_id || 'NONE');
console.log('');

// Check if has access
const hasAccess = member.aptus_user_id || member.parakey_user_id;
console.log('  Has access:', hasAccess ? 'YES' : 'NO');
console.log('');

// Check payment status
const oneYearAgo = new Date();
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

const hasRecentAnnual = member.last_annual_fee_date && member.last_annual_fee_date > oneYearAgoStr;
const hasRecentEntrance = member.last_entrance_fee_date && member.last_entrance_fee_date > oneYearAgoStr;
const hasEverPaidAnnual = !!member.last_annual_fee_date;
const hasEverPaidEntrance = !!member.last_entrance_fee_date;

console.log('📊 Payment Analysis:');
console.log('  Paid annual fee within last year:', hasRecentAnnual ? 'YES' : 'NO');
console.log('  Paid entrance fee within last year:', hasRecentEntrance ? 'YES' : 'NO');
console.log('  Ever paid annual fee:', hasEverPaidAnnual ? 'YES' : 'NO');
console.log('  Ever paid entrance fee:', hasEverPaidEntrance ? 'YES' : 'NO');
console.log('');

// Check visits
const { data: visits } = await supabase
  .from('visits')
  .select('*')
  .or(`userid.eq.${member.aptus_user_id || 'null'},userid.eq.${member.parakey_user_id || 'null'}`)
  .order('eventtime', { ascending: false })
  .limit(5);

console.log('🚪 Recent Visits:', visits?.length || 0);
if (visits && visits.length > 0) {
  console.log('  Last visit:', visits[0].eventtime);
}
console.log('');

// Check relations
const { data: relations } = await supabase
  .from('member_relations')
  .select('*')
  .eq('medbadare_member_id', member.id);

console.log('👥 Relations:', relations?.length || 0);
if (relations && relations.length > 0) {
  console.log('  Linked to primary member:', relations[0].primary_member_id);
}
console.log('');

// Calculate category based on getMemberCategory logic
console.log('🏷️  Category Calculation:');
console.log('');

const isMedbadare = relations && relations.length > 0;
const hasPaidMembershipFee = hasRecentAnnual || hasRecentEntrance;

console.log('Step-by-step logic:');
console.log('  1. Has paid membership fee (within 1 year):', hasPaidMembershipFee ? 'YES' : 'NO');
console.log('  2. Status in Fortnox:', member.status);
console.log('  3. Is medbadare (has relation):', isMedbadare ? 'YES' : 'NO');
console.log('  4. Has access:', hasAccess ? 'YES' : 'NO');
console.log('  5. Ever paid membership fee:', hasEverPaidAnnual || hasEverPaidEntrance ? 'YES' : 'NO');
console.log('');

let category;
if (hasPaidMembershipFee && visits && visits.length > 0) {
  category = 'MEDLEM';
} else if (hasPaidMembershipFee && (!visits || visits.length === 0)) {
  category = 'SPONSOR';
} else if (member.status === 'KÖANDE') {
  category = 'KÖANDE';
} else if (isMedbadare) {
  category = 'MEDBADARE';
} else if (hasAccess && !hasEverPaidAnnual && !hasEverPaidEntrance) {
  category = 'MEDBADARE';
} else {
  category = 'INAKTIV';
}

console.log('📌 CALCULATED CATEGORY:', category);
console.log('');

console.log('🤔 Analysis:');
if (member.status === 'KÖANDE' && category !== 'KÖANDE') {
  console.log('  ⚠️  Status in Fortnox is KÖANDE but categorized as', category);
  console.log('  Problem: Logic checks payment status BEFORE checking KÖANDE status');
  console.log('');
  console.log('  Current logic order:');
  console.log('    1. Paid + has visits → MEDLEM');
  console.log('    2. Paid + no visits → SPONSOR');
  console.log('    3. Status = KÖANDE → KÖANDE  ← This check happens too late!');
  console.log('');
  console.log('  Suggestion: Move KÖANDE check earlier in the logic');
}
