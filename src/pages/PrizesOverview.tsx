import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { Trophy, TrendingUp, Award, Calendar, Clock, Target } from 'lucide-react';
import {
  BADGE_DEFINITIONS,
  getBadgeInfo,
  getCategoryDisplayName,
  isChampionBadge,
  type BadgeInfo
} from '../lib/badge-info';
import { MobileContainer } from '../components/layout/MobileContainer';
import { useSidebar } from '../contexts/SidebarContext';

interface BadgeStats {
  type: string;
  count: number;
  holders?: Array<{
    userId: string;
    firstName: string;
    lastName: string;
    customerNumber: string;
    rank?: number;
    visits?: number;
    metadata?: any;
  }>;
}

interface LeaderboardEntry {
  userId: string;
  visitCount: number;
  rank?: number;
  firstName?: string;
  lastName?: string;
  customerNumber?: string;
}

const categoryIcons: Record<BadgeInfo['category'], any> = {
  frequency: TrendingUp,
  streak: Award,
  time: Clock,
  milestone: Target,
  anniversary: Calendar,
  challenge: Trophy
};

export function PrizesOverview() {
  const navigate = useNavigate();
  const { openSidebar } = useSidebar();
  const [badgeStats, setBadgeStats] = useState<Record<string, BadgeStats>>({});
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBadgeData();
  }, []);

  const loadBadgeData = async () => {
    setLoading(true);

    try {
      // Load badge holder counts and info for all badge types IN PARALLEL
      const stats: Record<string, BadgeStats> = {};
      const badgeEntries = Object.entries(BADGE_DEFINITIONS);

      // Step 1: Fetch all counts in parallel
      const countPromises = badgeEntries.map(([type]) =>
        supabase
          .from('member_achievements')
          .select('user_id, members!inner(is_system_account)', { count: 'exact', head: true })
          .eq('achievement_type', type)
          .eq('is_active', true)
          .eq('members.is_system_account', false)
      );

      const countResults = await Promise.all(countPromises);

      // Process count results
      countResults.forEach((result, index) => {
        const [type] = badgeEntries[index];
        if (result.error) {
          console.error(`Error loading count for ${type}:`, result.error);
        } else {
          stats[type] = {
            type,
            count: result.count || 0
          };
        }
      });

      // Step 2: Identify dynamic badges that need holder details
      const dynamicBadges = badgeEntries.filter(([_, info]) =>
        info.isDynamic && (info.rank !== undefined || info.maxRank !== undefined)
      );

      // Step 3: Fetch all holder details in parallel
      const holderPromises = dynamicBadges.map(([type]) =>
        supabase
          .from('member_achievements')
          .select(`
            user_id,
            achievement_data,
            members!inner (
              id,
              first_name,
              last_name,
              fortnox_customer_number,
              is_system_account
            )
          `)
          .eq('achievement_type', type)
          .eq('is_active', true)
          .eq('members.is_system_account', false)
      );

      const holderResults = await Promise.all(holderPromises);

      // Process holder results
      holderResults.forEach((result, index) => {
        const [type] = dynamicBadges[index];
        if (result.error) {
          console.error(`Error loading holders for ${type}:`, result.error);
        } else if (result.data && result.data.length > 0) {
          stats[type].holders = result.data.map((h: any) => ({
            userId: h.user_id,
            firstName: h.members.first_name,
            lastName: h.members.last_name,
            customerNumber: h.members.fortnox_customer_number,
            rank: h.achievement_data?.rank,
            visits: h.achievement_data?.visits,
            metadata: h.achievement_data
          }))
          .sort((a, b) => (a.rank || 0) - (b.rank || 0));
        }
      });

      setBadgeStats(stats);

      // Load leaderboards for champion badges (to show runner-ups)
      await loadLeaderboards();

    } catch (error) {
      console.error('Error loading badge data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboards = async () => {
    // Fetch ALL leaderboards IN PARALLEL for champion badges (to show runner-ups)
    const boards: Record<string, LeaderboardEntry[]> = {};

    try {
      const sides = ['gents', 'ladies'] as const;
      const timeSlots = [
        { badge: 'morning_bird', start: 5, end: 8 },
        { badge: 'foermiddagspasset', start: 8, end: 11 },
        { badge: 'lunch_badare', start: 11, end: 14 },
        { badge: 'eftermiddagsklubben', start: 14, end: 18 },
        { badge: 'evening_bastare', start: 18, end: 20 },
        { badge: 'night_owl', start: 20, end: 22 }
      ];

      // Build all promises (cast to Promise to satisfy TypeScript)
      const allPromises: Array<Promise<any>> = [];
      const promiseKeys: Array<{ key: string; type: 'frequency' | 'time' }> = [];

      // Add frequency leaderboard promises (monthly & quarterly for both sides)
      for (const side of sides) {
        allPromises.push(
          supabase.rpc('get_top_bastare', { days: 30, limit_count: 10, side }) as unknown as Promise<any>
        );
        promiseKeys.push({ key: `monthly_champion_${side}`, type: 'frequency' });

        allPromises.push(
          supabase.rpc('get_top_bastare', { days: 90, limit_count: 10, side }) as unknown as Promise<any>
        );
        promiseKeys.push({ key: `quarterly_champion_${side}`, type: 'frequency' });

        // Add time-based leaderboard promises
        for (const slot of timeSlots) {
          allPromises.push(
            supabase.rpc('get_time_based_leaderboard', {
              start_hour: slot.start,
              end_hour: slot.end,
              period_days: 30,
              limit_count: 10,
              side
            }) as unknown as Promise<any>
          );
          promiseKeys.push({ key: `${slot.badge}_${side}`, type: 'time' });
        }
      }

      // Execute all queries in parallel
      const results = await Promise.all(allPromises);

      // Process results
      results.forEach((result, index) => {
        const { key } = promiseKeys[index];
        if (result.data) {
          boards[key] = result.data.map((m: any) => ({
            userId: m.user_id,
            visitCount: m.visit_count,
            rank: m.rank,
            firstName: m.first_name,
            lastName: m.last_name,
            customerNumber: m.customer_number
          }));
        }
      });

      setLeaderboards(boards);
    } catch (error) {
      console.error('Error loading leaderboards:', error);
    }
  };

  const navigateToFiltered = (badgeType: string) => {
    navigate(`/members?badges=${badgeType}`);
  };

  const renderBadgeCard = (type: string, info: BadgeInfo) => {
    const stats = badgeStats[type];
    if (!stats) return null;

    const badgeInfo = getBadgeInfo(type);
    const isChampion = isChampionBadge(type);
    const isTimeBased = info.category === 'time';
    const leaderboard = leaderboards[type];

    return (
      <Card key={type} className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">{badgeInfo.emoji}</span>
            <div>
              <div>{badgeInfo.name}</div>
              <CardDescription className="text-xs">{badgeInfo.description}</CardDescription>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dynamic badges with ranking */}
          {info.isDynamic && (info.rank !== undefined || info.maxRank !== undefined) && (
            <>
              {/* Champion badges: show current holder + runner-ups only for time-based badges */}
              {isChampion && stats.holders && stats.holders.length > 0 && (
                <div className="space-y-3">
                  <div className="bg-accent/10 p-3 rounded-lg border border-accent/20">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Aktuell innehavare
                    </p>
                    <Link
                      to={`/members/${stats.holders[0].userId}`}
                      className="text-lg font-bold hover:underline text-foreground"
                    >
                      {stats.holders[0].firstName} {stats.holders[0].lastName}
                    </Link>
                    {stats.holders[0].visits && (
                      <p className="text-sm text-muted-foreground">
                        {stats.holders[0].visits} besök
                      </p>
                    )}
                  </div>

                  {/* Only show runner-ups for time-based badges (not frequency badges) */}
                  {isTimeBased && leaderboard && leaderboard.length > 1 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Runner-ups
                      </p>
                      <div className="space-y-1">
                        {leaderboard.slice(1, 4).map((entry) => (
                          <Link
                            key={entry.userId}
                            to={`/members/${entry.userId}`}
                            className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted/50"
                          >
                            <span className="font-medium">
                              #{entry.rank} {entry.firstName} {entry.lastName}
                            </span>
                            <span className="text-muted-foreground">
                              {entry.visitCount} besök
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Top-N badges: show all holders with their ranks */}
              {!isChampion && stats.holders && stats.holders.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Aktuella innehavare ({stats.holders.length})
                  </p>
                  <div className="space-y-1">
                    {stats.holders.map((holder) => (
                      <Link
                        key={holder.userId}
                        to={`/members/${holder.userId}`}
                        className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted/50"
                      >
                        <span className="font-medium">
                          #{holder.rank} {holder.firstName} {holder.lastName}
                        </span>
                        {holder.visits && (
                          <span className="text-muted-foreground">
                            {holder.visits} besök
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Streak badges: dynamic but no ranking - show count */}
          {info.isDynamic && !info.rank && !info.maxRank && (
            <div>
              <p className="text-3xl font-bold text-center">{stats.count}</p>
              <p className="text-sm text-muted-foreground text-center">
                {stats.count === 1 ? 'medlem har aktiv streak' : 'medlemmar har aktiv streak'}
              </p>
            </div>
          )}

          {/* Permanent badges: just show count */}
          {!info.isDynamic && (
            <div>
              <p className="text-3xl font-bold text-center">{stats.count}</p>
              <p className="text-sm text-muted-foreground text-center">
                {stats.count === 1 ? 'medlem' : 'medlemmar'}
              </p>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigateToFiltered(type)}
          >
            Visa alla med detta märke →
          </Button>
        </CardContent>
      </Card>
    );
  };

  const renderCategory = (category: BadgeInfo['category'], customLayout?: 'frequency') => {
    const badges = Object.entries(BADGE_DEFINITIONS)
      .filter(([_, info]) => info.category === category);

    if (badges.length === 0) return null;

    const Icon = categoryIcons[category];
    const isDynamic = badges[0][1].isDynamic;

    // Special layout for frequency badges: 2 columns, specific order
    if (customLayout === 'frequency') {
      const row1 = ['monthly_champion', 'quarterly_champion'];
      const row2 = ['top10_30d', 'veteran'];

      return (
        <div key={category} className="space-y-4">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">{getCategoryDisplayName(category)}</h2>
            {isDynamic && (
              <Badge variant="outline" className="ml-2">
                Dynamiska
              </Badge>
            )}
          </div>
          {/* Row 1: Monthly & Quarterly Champions */}
          <div className="grid gap-4 md:grid-cols-2">
            {row1.map(type => {
              const badge = badges.find(([t]) => t === type);
              return badge ? renderBadgeCard(badge[0], badge[1]) : null;
            })}
          </div>
          {/* Row 2: Bas-Stjärna & Veteran */}
          <div className="grid gap-4 md:grid-cols-2">
            {row2.map(type => {
              const badge = badges.find(([t]) => t === type);
              return badge ? renderBadgeCard(badge[0], badge[1]) : null;
            })}
          </div>
          {/* Remaining badges if any (top3_30d) */}
          {badges.filter(([type]) => ![...row1, ...row2].includes(type)).length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {badges
                .filter(([type]) => ![...row1, ...row2].includes(type))
                .map(([type, info]) => renderBadgeCard(type, info))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={category} className="space-y-4">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">{getCategoryDisplayName(category)}</h2>
          {isDynamic && (
            <Badge variant="outline" className="ml-2">
              Dynamiska
            </Badge>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {badges.map(([type, info]) => renderBadgeCard(type, info))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <MobileContainer className="overflow-hidden">
        {/* Custom Header */}
        <div className="z-10 h-auto py-3 px-4 pb-4 flex items-center justify-between bg-card/80 backdrop-blur-xl border-b border-border/30 w-full box-border flex-shrink-0">
          {/* Menu button */}
          <button
            className="p-2 -ml-2 hover:bg-accent active:bg-accent/80 rounded-lg transition-colors lg:invisible"
            onClick={openSidebar}
            aria-label="Öppna meny"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-foreground">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Center title */}
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <div className="text-[17px] font-semibold text-foreground flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Utmärkelser & Priser
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-background w-full">
          <div className="py-4 px-4 w-full box-border">
            <p className="text-muted-foreground text-center">Laddar prisdata...</p>
          </div>
        </div>
      </MobileContainer>
    );
  }

  const renderSideSection = (side: 'gents' | 'ladies') => {
    const sideName = side === 'gents' ? 'Herrsidan' : 'Damsidan';
    const sideEmoji = side === 'gents' ? '👔' : '👗';

    // Get all badges for this side
    const frequencyBadges = Object.entries(BADGE_DEFINITIONS)
      .filter(([type, _]) => type.endsWith(`_${side}`) && BADGE_DEFINITIONS[type].category === 'frequency');
    const timeBadges = Object.entries(BADGE_DEFINITIONS)
      .filter(([type, _]) => type.endsWith(`_${side}`) && BADGE_DEFINITIONS[type].category === 'time');
    const milestoneBadges = Object.entries(BADGE_DEFINITIONS)
      .filter(([type, _]) => type.endsWith(`_${side}`) && BADGE_DEFINITIONS[type].category === 'milestone');

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">{sideEmoji}</span>
            {sideName}
          </CardTitle>
          <CardDescription>
            Utmärkelser baserade på aktivitet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Frequency badges for this side */}
          {frequencyBadges.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Frekvens</h3>
              </div>
              <div className="grid gap-3">
                {frequencyBadges.map(([type, info]) => renderBadgeCard(type, info))}
              </div>
            </div>
          )}

          <Separator />

          {/* Time badges for this side */}
          {timeBadges.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Tid</h3>
              </div>
              <div className="grid gap-3">
                {timeBadges.map(([type, info]) => renderBadgeCard(type, info))}
              </div>
            </div>
          )}

          <Separator />

          {/* Milestone badges for this side */}
          {milestoneBadges.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Milstolpar</h3>
              </div>
              <div className="grid gap-3 grid-cols-2">
                {milestoneBadges.map(([type, info]) => renderBadgeCard(type, info))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <MobileContainer className="overflow-hidden">
      {/* Custom Header */}
      <div className="z-10 h-auto py-3 px-4 pb-4 flex items-center justify-between bg-card/80 backdrop-blur-xl border-b border-border/30 w-full box-border flex-shrink-0">
        {/* Menu button */}
        <button
          className="p-2 -ml-2 hover:bg-accent active:bg-accent/80 rounded-lg transition-colors lg:invisible"
          onClick={openSidebar}
          aria-label="Öppna meny"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-foreground">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Center title */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <div className="text-[17px] font-semibold text-foreground flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Utmärkelser & Priser
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-background w-full">
        <div className="py-4 px-4 w-full box-border space-y-6">
          {/* Two-column layout for sides */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Herrsidan */}
            <div className="space-y-4">
              {renderSideSection('gents')}
            </div>

            {/* Damsidan */}
            <div className="space-y-4">
              {renderSideSection('ladies')}
            </div>
          </div>

          <Separator className="my-8" />

          {/* Combined/Shared Badges (Streak, Anniversary, Challenge) */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Gemensamma Utmärkelser</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Dessa utmärkelser gäller båda sidorna
              </p>
            </div>
            {renderCategory('streak')}
            <Separator />
            {renderCategory('anniversary')}
            <Separator />
            {renderCategory('challenge')}
          </div>
        </div>
      </div>
    </MobileContainer>
  );
}
