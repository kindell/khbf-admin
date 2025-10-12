import { type Member } from './supabase';

export type MemberCategory = 'MEDLEM' | 'SPONSOR' | 'KÖANDE' | 'MEDBADARE' | 'INAKTIV';

/**
 * Calculate member category based on payment history, access, and visit activity
 *
 * Note: member.related_members is populated by App.tsx when loading member data
 */
export function getMemberCategory(member: Member): MemberCategory {
  const now = new Date();
  const thirteenMonthsAgo = new Date(now.getTime() - 13 * 30 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000);

  // Check if has paid annual or entrance fee within last 13 months
  const hasRecentAnnualFee = member.last_annual_fee_date &&
    new Date(member.last_annual_fee_date) >= thirteenMonthsAgo;
  const hasRecentEntranceFee = member.last_entrance_fee_date &&
    new Date(member.last_entrance_fee_date) >= thirteenMonthsAgo;
  const hasPaidMembershipFee = hasRecentAnnualFee || hasRecentEntranceFee;

  // Check if has paid queue fee (any time)
  const hasQueueFee = !!member.last_queue_fee_date;

  // Check if has access (Parakey or RFID/Aptus)
  const hasAccess = !!(member.parakey_user_id || member.aptus_user_id);

  // Check if has recent visits (within 3 months)
  const hasRecentVisits = member.last_visit_at &&
    new Date(member.last_visit_at) >= threeMonthsAgo;

  // Check if has ever paid annual or entrance fee (membership fees)
  const hasEverPaidMembershipFee = !!(member.last_annual_fee_date || member.last_entrance_fee_date);

  // Check if is linked as medbadare to another member
  // @ts-ignore - related_members is added dynamically by App.tsx
  const isMedbadare = member.related_members && member.related_members.length > 0;

  // Classification logic
  if (hasPaidMembershipFee && hasRecentVisits) {
    return 'MEDLEM';
  }

  if (hasPaidMembershipFee && !hasRecentVisits) {
    // Paid membership but no recent visits = SPONSOR
    // (regardless of whether they have access or not)
    return 'SPONSOR';
  }

  // KÖANDE: Trust DB status for queue members
  // Backend handles complex logic like unpaid invoices and 13-month expiry
  if (member.status === 'KÖANDE') {
    return 'KÖANDE';
  }

  // MEDBADARE: Either has relation to active member OR has access but never paid
  if (isMedbadare) {
    return 'MEDBADARE';
  }

  if (hasAccess && !hasEverPaidMembershipFee) {
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
