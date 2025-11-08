/**
 * SMS Variable replacement utility
 * Replaces template variables with member-specific data
 */

export interface MemberWithVisits {
  id: string;
  first_name: string;
  last_name: string;
  visits_last_week?: number;
  visits_last_3_months?: number;
  last_visit_at?: string | null;
}

/**
 * Available SMS variables
 */
export const SMS_VARIABLES = {
  '{{förnamn}}': 'Mottagarens förnamn',
  '{{efternamn}}': 'Mottagarens efternamn',
  '{{namn}}': 'Fullständigt namn (förnamn + efternamn)',
  '{{besök_vecka}}': 'Antal besök senaste veckan',
  '{{besök_kvartal}}': 'Antal besök senaste kvartalet (3 mån)',
  '{{dagar_sedan}}': 'Antal dagar sedan senaste besök',
  '{{senaste_besök}}': 'Datum för senaste besök (t.ex. "5 november")',
} as const;

/**
 * Calculate days since last visit
 */
function calculateDaysSinceLastVisit(lastVisitAt: string | null | undefined): number {
  if (!lastVisitAt) return 999; // Return large number if no visits

  const lastVisit = new Date(lastVisitAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - lastVisit.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Replace template variables with actual member data
 * @param template - Message template with variables like {{förnamn}}
 * @param member - Member data including visit statistics
 * @returns Message with variables replaced
 */
export function replaceMessageVariables(
  template: string,
  member: MemberWithVisits
): string {
  let message = template;

  // Replace {{förnamn}}
  message = message.replace(/\{\{förnamn\}\}/gi, member.first_name || '');

  // Replace {{efternamn}}
  message = message.replace(/\{\{efternamn\}\}/gi, member.last_name || '');

  // Replace {{namn}}
  const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim();
  message = message.replace(/\{\{namn\}\}/gi, fullName);

  // Replace {{besök_vecka}}
  message = message.replace(
    /\{\{besök_vecka\}\}/gi,
    (member.visits_last_week || 0).toString()
  );

  // Replace {{besök_kvartal}}
  message = message.replace(
    /\{\{besök_kvartal\}\}/gi,
    (member.visits_last_3_months || 0).toString()
  );

  // Replace {{dagar_sedan}}
  const daysSince = calculateDaysSinceLastVisit(member.last_visit_at);
  message = message.replace(/\{\{dagar_sedan\}\}/gi, daysSince.toString());

  // Replace {{senaste_besök}}
  if (member.last_visit_at) {
    const lastVisitDate = new Date(member.last_visit_at);
    const formattedDate = lastVisitDate.toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/Stockholm'
    });
    message = message.replace(/\{\{senaste_besök\}\}/gi, formattedDate);
  } else {
    message = message.replace(/\{\{senaste_besök\}\}/gi, 'aldrig');
  }

  return message;
}

/**
 * Check if a message contains variables
 */
export function hasVariables(message: string): boolean {
  return /\{\{[^}]+\}\}/.test(message);
}

/**
 * Extract all variables used in a message
 */
export function extractVariables(message: string): string[] {
  const matches = message.match(/\{\{[^}]+\}\}/g);
  return matches ? [...new Set(matches)] : [];
}
