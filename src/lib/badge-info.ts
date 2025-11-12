/**
 * Badge Information and Utilities
 *
 * Centralized badge metadata and helper functions for the KHBF badge system.
 */

export interface BadgeInfo {
  emoji: string;
  name: string;
  description: string;
  category: 'streak' | 'frequency' | 'time' | 'milestone' | 'anniversary' | 'challenge';
  isDynamic: boolean;
  period?: number; // Days (7, 28, 30, 84) or null for all-time
  rank?: number; // For champion badges (rank: 1)
  maxRank?: number; // For top3, top5, top10 badges
}

export const BADGE_DEFINITIONS: Record<string, BadgeInfo> = {
  // Streak badges (dynamic)
  'streak_3d': {
    emoji: '🔥',
    name: 'Hetluftsälskare',
    description: 'Besökt bastun 3 dagar i rad',
    category: 'streak',
    isDynamic: true,
    period: 3
  },
  'streak_7d': {
    emoji: '⭐',
    name: 'Vecko-Mästare',
    description: 'Besökt bastun 7 dagar i rad',
    category: 'streak',
    isDynamic: true,
    period: 7
  },
  'streak_14d': {
    emoji: '💪',
    name: 'Bastufantast',
    description: 'Besökt bastun 14 dagar i rad',
    category: 'streak',
    isDynamic: true,
    period: 14
  },
  'streak_30d': {
    emoji: '👑',
    name: 'Månadens Bastare',
    description: 'Besökt bastun 30 dagar i rad',
    category: 'streak',
    isDynamic: true,
    period: 30
  },

  // Frequency badges - 30 days (dynamic)
  'monthly_champion': {
    emoji: '🥇',
    name: 'Månadens Mästare',
    description: 'Flest besök senaste månaden',
    category: 'frequency',
    isDynamic: true,
    period: 30,
    rank: 1
  },
  'top10_30d': {
    emoji: '⭐',
    name: 'Bas-Stjärna',
    description: 'Topp 10 mest aktiva senaste månaden',
    category: 'frequency',
    isDynamic: true,
    period: 30,
    maxRank: 10
  },

  // Frequency badges - 90 days (dynamic)
  'quarterly_champion': {
    emoji: '🏆',
    name: 'Kvartals-Champion',
    description: 'Flest besök senaste kvartalet',
    category: 'frequency',
    isDynamic: true,
    period: 90,
    rank: 1
  },
  'veteran': {
    emoji: '🎖️',
    name: 'Veteran',
    description: 'Topp 5 senaste kvartalet',
    category: 'frequency',
    isDynamic: true,
    period: 90,
    maxRank: 5
  },

  // Time-based badges (dynamic)
  'morning_bird': {
    emoji: '🌅',
    name: 'Morgonpigg',
    description: 'Flest besök 05-09 på morgonen',
    category: 'time',
    isDynamic: true,
    period: 30,
    rank: 1
  },
  'evening_bastare': {
    emoji: '🌆',
    name: 'Kvällsbastare',
    description: 'Flest besök 17-21 på kvällen',
    category: 'time',
    isDynamic: true,
    period: 30,
    rank: 1
  },
  'night_owl': {
    emoji: '🦉',
    name: 'Nattuggla',
    description: 'Flest besök 21-01 på natten',
    category: 'time',
    isDynamic: true,
    period: 30,
    rank: 1
  },

  // Milestone badges (permanent)
  'visits_100': {
    emoji: '💯',
    name: 'Hundralapp',
    description: 'Totalt 100 besök',
    category: 'milestone',
    isDynamic: false
  },
  'visits_500': {
    emoji: '🎯',
    name: 'Femhundralapp',
    description: 'Totalt 500 besök',
    category: 'milestone',
    isDynamic: false
  },
  'visits_1000': {
    emoji: '🚀',
    name: 'Tusenlapp',
    description: 'Totalt 1000 besök',
    category: 'milestone',
    isDynamic: false
  },
  'visits_5000': {
    emoji: '⚡',
    name: 'Legendarisk',
    description: 'Totalt 5000 besök',
    category: 'milestone',
    isDynamic: false
  },

  // Anniversary badges (permanent)
  'newbie': {
    emoji: '🌱',
    name: 'Nykomling',
    description: 'Ny medlem',
    category: 'anniversary',
    isDynamic: false
  },
  'anniversary_1y': {
    emoji: '🥉',
    name: 'Brons-Bastare',
    description: 'Medlem i 1 år',
    category: 'anniversary',
    isDynamic: false
  },
  'anniversary_5y': {
    emoji: '🥈',
    name: 'Silver-Veteran',
    description: 'Medlem i 5 år',
    category: 'anniversary',
    isDynamic: false
  },
  'anniversary_10y': {
    emoji: '🥇',
    name: 'Guld-Legend',
    description: 'Medlem i 10 år',
    category: 'anniversary',
    isDynamic: false
  },
  'anniversary_15y': {
    emoji: '💎',
    name: 'Diamant-Pionjär',
    description: 'Medlem i 15 år',
    category: 'anniversary',
    isDynamic: false
  },
  'anniversary_20y': {
    emoji: '👑',
    name: 'Platina-Ikon',
    description: 'Medlem i 20 år',
    category: 'anniversary',
    isDynamic: false
  },

  // Challenge badges (permanent)
  'weekly_warrior': {
    emoji: '⚔️',
    name: 'Vecko-Warrior',
    description: 'Genomfört en 7-dagars streak',
    category: 'challenge',
    isDynamic: false
  },
  'monthly_marathon': {
    emoji: '🏃',
    name: 'Månads-Marathon',
    description: 'Genomfört en 28-dagars streak',
    category: 'challenge',
    isDynamic: false
  }
};

/**
 * Get badge information by achievement type
 */
export function getBadgeInfo(achievementType: string): { emoji: string; name: string; description: string } {
  const badge = BADGE_DEFINITIONS[achievementType];

  if (badge) {
    return {
      emoji: badge.emoji,
      name: badge.name,
      description: badge.description
    };
  }

  // Fallback for unknown badges
  return {
    emoji: '🏅',
    name: achievementType.replace(/_/g, ' '),
    description: 'Specialmedalj'
  };
}

/**
 * Get full badge information including metadata
 */
export function getBadgeFullInfo(achievementType: string): BadgeInfo | null {
  return BADGE_DEFINITIONS[achievementType] || null;
}

/**
 * Check if a badge is dynamic (can be revoked)
 */
export function isBadgeDynamic(achievementType: string): boolean {
  return BADGE_DEFINITIONS[achievementType]?.isDynamic ?? false;
}

/**
 * Get all badges by category
 */
export function getBadgesByCategory(category: BadgeInfo['category']): Array<{ type: string; info: BadgeInfo }> {
  return Object.entries(BADGE_DEFINITIONS)
    .filter(([_, info]) => info.category === category)
    .map(([type, info]) => ({ type, info }));
}

/**
 * Get all badges, optionally filtered by dynamic status
 */
export function getAllBadges(dynamicOnly?: boolean): Array<{ type: string; info: BadgeInfo }> {
  const badges = Object.entries(BADGE_DEFINITIONS).map(([type, info]) => ({ type, info }));

  if (dynamicOnly !== undefined) {
    return badges.filter(({ info }) => info.isDynamic === dynamicOnly);
  }

  return badges;
}

/**
 * Get category display name in Swedish
 */
export function getCategoryDisplayName(category: BadgeInfo['category']): string {
  const names: Record<BadgeInfo['category'], string> = {
    streak: 'Streak',
    frequency: 'Frekvens',
    time: 'Tid',
    milestone: 'Milstolpe',
    anniversary: 'Årsdag',
    challenge: 'Challenge'
  };

  return names[category] || category;
}

/**
 * Check if badge shows ranking (champion or top-N)
 */
export function isRankingBadge(achievementType: string): boolean {
  const badge = BADGE_DEFINITIONS[achievementType];
  return badge ? (badge.rank !== undefined || badge.maxRank !== undefined) : false;
}

/**
 * Check if badge is a champion (rank: 1) badge
 */
export function isChampionBadge(achievementType: string): boolean {
  return BADGE_DEFINITIONS[achievementType]?.rank === 1;
}

/**
 * Get period display text in Swedish
 */
export function getPeriodDisplayText(days?: number): string {
  if (!days) return 'Permanent';
  if (days === 3) return '3 dagar';
  if (days === 7) return 'Vecka';
  if (days === 14) return '2 veckor';
  if (days === 28) return '4 veckor';
  if (days === 30) return 'Månad';
  if (days === 90) return 'Kvartal (3 månader)';
  return `${days} dagar`;
}

/**
 * Get badge sort order value for sorting within categories
 * Higher values = more prestigious/difficult badges (sorted descending)
 */
export function getBadgeSortValue(achievementType: string): number {
  // Define explicit sort orders for all badges
  const sortValues: Record<string, number> = {
    // Frequency badges - sorted by ranking breadth (top10 → champion month → top5 → champion quarter)
    'top10_30d': 50,           // Topp 10 månaden
    'monthly_champion': 30,    // #1 månaden
    'veteran': 20,             // Topp 5 kvartalet
    'quarterly_champion': 10,  // #1 kvartalet

    // Streak badges - by days (shortest first)
    'streak_3d': 30,
    'streak_7d': 20,
    'streak_14d': 10,
    'streak_30d': 5,

    // Time-based badges - by time of day (arbitrary ordering)
    'morning_bird': 3,
    'evening_bastare': 2,
    'night_owl': 1,

    // Milestone badges - by visit count (highest first)
    'visits_5000': 5000,
    'visits_1000': 1000,
    'visits_500': 500,
    'visits_100': 100,

    // Anniversary badges - by years (most years first)
    'anniversary_20y': 20,
    'anniversary_15y': 15,
    'anniversary_10y': 10,
    'anniversary_5y': 5,
    'anniversary_1y': 1,
    'newbie': 0,

    // Challenge badges - by difficulty (hardest first)
    'monthly_marathon': 28,
    'weekly_warrior': 7
  };

  return sortValues[achievementType] || 0;
}
