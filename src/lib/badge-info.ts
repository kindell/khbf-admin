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

  // Frequency badges - 30 days GENTS (dynamic)
  'monthly_champion_gents': {
    emoji: '🥇',
    name: 'Månadens Mästare Herr',
    description: 'Flest besök senaste månaden på herrsidan',
    category: 'frequency',
    isDynamic: true,
    period: 30,
    rank: 1
  },
  'top10_30d_gents': {
    emoji: '⭐',
    name: 'Bas-Stjärna Herr',
    description: 'Topp 10 mest aktiva senaste månaden på herrsidan',
    category: 'frequency',
    isDynamic: true,
    period: 30,
    maxRank: 10
  },

  // Frequency badges - 30 days LADIES (dynamic)
  'monthly_champion_ladies': {
    emoji: '🥇',
    name: 'Månadens Mästare Dam',
    description: 'Flest besök senaste månaden på damsidan',
    category: 'frequency',
    isDynamic: true,
    period: 30,
    rank: 1
  },
  'top10_30d_ladies': {
    emoji: '⭐',
    name: 'Bas-Stjärna Dam',
    description: 'Topp 10 mest aktiva senaste månaden på damsidan',
    category: 'frequency',
    isDynamic: true,
    period: 30,
    maxRank: 10
  },

  // Frequency badges - 90 days GENTS (dynamic)
  'quarterly_champion_gents': {
    emoji: '🏆',
    name: 'Kvartals-Champion Herr',
    description: 'Flest besök senaste kvartalet på herrsidan',
    category: 'frequency',
    isDynamic: true,
    period: 90,
    rank: 1
  },
  'veteran_gents': {
    emoji: '🎖️',
    name: 'Veteran Herr',
    description: 'Topp 5 senaste kvartalet på herrsidan',
    category: 'frequency',
    isDynamic: true,
    period: 90,
    maxRank: 5
  },

  // Frequency badges - 90 days LADIES (dynamic)
  'quarterly_champion_ladies': {
    emoji: '🏆',
    name: 'Kvartals-Champion Dam',
    description: 'Flest besök senaste kvartalet på damsidan',
    category: 'frequency',
    isDynamic: true,
    period: 90,
    rank: 1
  },
  'veteran_ladies': {
    emoji: '🎖️',
    name: 'Veteran Dam',
    description: 'Topp 5 senaste kvartalet på damsidan',
    category: 'frequency',
    isDynamic: true,
    period: 90,
    maxRank: 5
  },

  // Time-based badges GENTS (dynamic)
  'morning_bird_gents': {
    emoji: '🌅',
    name: 'Morgonpigg Herr',
    description: 'Flest besök 05-09 på morgonen på herrsidan',
    category: 'time',
    isDynamic: true,
    period: 30,
    rank: 1
  },
  'evening_bastare_gents': {
    emoji: '🌆',
    name: 'Kvällsbastare Herr',
    description: 'Flest besök 17-21 på kvällen på herrsidan',
    category: 'time',
    isDynamic: true,
    period: 30,
    rank: 1
  },
  'night_owl_gents': {
    emoji: '🦉',
    name: 'Nattuggla Herr',
    description: 'Flest besök 21-01 på natten på herrsidan',
    category: 'time',
    isDynamic: true,
    period: 30,
    rank: 1
  },

  // Time-based badges LADIES (dynamic)
  'morning_bird_ladies': {
    emoji: '🌅',
    name: 'Morgonpigg Dam',
    description: 'Flest besök 05-09 på morgonen på damsidan',
    category: 'time',
    isDynamic: true,
    period: 30,
    rank: 1
  },
  'evening_bastare_ladies': {
    emoji: '🌆',
    name: 'Kvällsbastare Dam',
    description: 'Flest besök 17-21 på kvällen på damsidan',
    category: 'time',
    isDynamic: true,
    period: 30,
    rank: 1
  },
  'night_owl_ladies': {
    emoji: '🦉',
    name: 'Nattuggla Dam',
    description: 'Flest besök 21-01 på natten på damsidan',
    category: 'time',
    isDynamic: true,
    period: 30,
    rank: 1
  },

  // Milestone badges GENTS (permanent)
  'visits_100_gents': {
    emoji: '💯',
    name: 'Hundralapp Herr',
    description: 'Totalt 100 besök på herrsidan',
    category: 'milestone',
    isDynamic: false
  },
  'visits_500_gents': {
    emoji: '🎯',
    name: 'Femhundralapp Herr',
    description: 'Totalt 500 besök på herrsidan',
    category: 'milestone',
    isDynamic: false
  },
  'visits_1000_gents': {
    emoji: '🚀',
    name: 'Tusenlapp Herr',
    description: 'Totalt 1000 besök på herrsidan',
    category: 'milestone',
    isDynamic: false
  },
  'visits_5000_gents': {
    emoji: '⚡',
    name: 'Legendarisk Herr',
    description: 'Totalt 5000 besök på herrsidan',
    category: 'milestone',
    isDynamic: false
  },

  // Milestone badges LADIES (permanent)
  'visits_100_ladies': {
    emoji: '💯',
    name: 'Hundralapp Dam',
    description: 'Totalt 100 besök på damsidan',
    category: 'milestone',
    isDynamic: false
  },
  'visits_500_ladies': {
    emoji: '🎯',
    name: 'Femhundralapp Dam',
    description: 'Totalt 500 besök på damsidan',
    category: 'milestone',
    isDynamic: false
  },
  'visits_1000_ladies': {
    emoji: '🚀',
    name: 'Tusenlapp Dam',
    description: 'Totalt 1000 besök på damsidan',
    category: 'milestone',
    isDynamic: false
  },
  'visits_5000_ladies': {
    emoji: '⚡',
    name: 'Legendarisk Dam',
    description: 'Totalt 5000 besök på damsidan',
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
    // Frequency badges GENTS - sorted by ranking breadth
    'top10_30d_gents': 50,
    'monthly_champion_gents': 30,
    'veteran_gents': 20,
    'quarterly_champion_gents': 10,

    // Frequency badges LADIES - sorted by ranking breadth
    'top10_30d_ladies': 50,
    'monthly_champion_ladies': 30,
    'veteran_ladies': 20,
    'quarterly_champion_ladies': 10,

    // Streak badges - by days (shortest first)
    'streak_3d': 30,
    'streak_7d': 20,
    'streak_14d': 10,
    'streak_30d': 5,

    // Time-based badges GENTS
    'morning_bird_gents': 3,
    'evening_bastare_gents': 2,
    'night_owl_gents': 1,

    // Time-based badges LADIES
    'morning_bird_ladies': 3,
    'evening_bastare_ladies': 2,
    'night_owl_ladies': 1,

    // Milestone badges GENTS - by visit count (highest first)
    'visits_5000_gents': 5000,
    'visits_1000_gents': 1000,
    'visits_500_gents': 500,
    'visits_100_gents': 100,

    // Milestone badges LADIES - by visit count (highest first)
    'visits_5000_ladies': 5000,
    'visits_1000_ladies': 1000,
    'visits_500_ladies': 500,
    'visits_100_ladies': 100,

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
