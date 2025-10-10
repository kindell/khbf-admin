import { type Member } from './supabase';

export type MemberCategory = 'MEDLEM' | 'SPONSOR' | 'KÖANDE' | 'MEDBADARE' | 'INAKTIV';

/**
 * Calculate member category based on payment history, access, and visit activity
 */
export function getMemberCategory(member: Member): MemberCategory {
  const now = new Date();
  const fifteenMonthsAgo = new Date(now.getTime() - 15 * 30 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000);

  // Check if has paid annual or entrance fee within last 15 months
  const hasRecentAnnualFee = member.last_annual_fee_date &&
    new Date(member.last_annual_fee_date) >= fifteenMonthsAgo;
  const hasRecentEntranceFee = member.last_entrance_fee_date &&
    new Date(member.last_entrance_fee_date) >= fifteenMonthsAgo;
  const hasPaidMembershipFee = hasRecentAnnualFee || hasRecentEntranceFee;

  // Check if has paid queue fee within last 15 months
  const hasRecentQueueFee = member.last_queue_fee_date &&
    new Date(member.last_queue_fee_date) >= fifteenMonthsAgo;

  // Check if has access (Parakey or RFID/Aptus)
  const hasAccess = !!(member.parakey_user_id || member.aptus_user_id);

  // Check if has recent visits (within 3 months)
  const hasRecentVisits = member.last_visit_at &&
    new Date(member.last_visit_at) >= threeMonthsAgo;

  // Classification logic
  if (hasPaidMembershipFee && hasRecentVisits) {
    return 'MEDLEM';
  }

  if (hasPaidMembershipFee && !hasRecentVisits) {
    // Paid membership but no recent visits = SPONSOR
    // (regardless of whether they have access or not)
    return 'SPONSOR';
  }

  if (hasRecentQueueFee && !hasPaidMembershipFee) {
    return 'KÖANDE';
  }

  if (hasAccess && !hasPaidMembershipFee && !hasRecentQueueFee) {
    return 'MEDBADARE';
  }

  return 'INAKTIV';
}

/**
 * Get badge variant for a category
 */
export function getCategoryBadgeVariant(category: MemberCategory): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (category) {
    case 'MEDLEM':
      return 'default'; // Blue/primary
    case 'SPONSOR':
      return 'secondary'; // Gray/gold
    case 'KÖANDE':
      return 'outline'; // Yellow outline
    case 'MEDBADARE':
      return 'outline'; // Gray outline
    case 'INAKTIV':
      return 'outline'; // Muted
    default:
      return 'outline';
  }
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: MemberCategory): string {
  return category;
}
