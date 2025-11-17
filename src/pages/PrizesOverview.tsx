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
  const [badgeStats, setBadgeStats] = useState<Record<string, BadgeStats>>({});
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBadgeData();
  }, []);

  const loadBadgeData = async () => {
    setLoading(true);

    try {
      // Load badge holder counts and info for all badge types
      const stats: Record<string, BadgeStats> = {};

      for (const [type, info] of Object.entries(BADGE_DEFINITIONS)) {
        // Get count of active holders (exclude system accounts)
        const { count, error: countError } = await supabase
          .from('member_achievements')
          .select('user_id, members!inner(is_system_account)', { count: 'exact', head: true })
          .eq('achievement_type', type)
          .eq('is_active', true)
          .eq('members.is_system_account', false);

        if (countError) {
          console.error(`Error loading count for ${type}:`, countError);
          continue;
        }

        stats[type] = {
          type,
          count: count || 0
        };

        // For dynamic badges with ranking, load holder details
        if (info.isDynamic && (info.rank !== undefined || info.maxRank !== undefined)) {
          const { data: holders, error: holdersError } = await supabase
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
            .eq('members.is_system_account', false);

          if (holdersError) {
            console.error(`Error loading holders for ${type}:`, holdersError);
            continue;
          }

          if (holders && holders.length > 0) {
            stats[type].holders = holders.map((h: any) => ({
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
        }
      }

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
    // Fetch top 10 for each period and side to show runner-ups for champion badges
    const boards: Record<string, LeaderboardEntry[]> = {};

    try {
      // Load for both sides
      for (const side of ['gents', 'ladies']) {
        // 30-day leaderboard
        const { data: monthly } = await supabase
          .rpc('get_top_bastare', { days: 30, limit_count: 10, side });

        if (monthly) {
          boards[`monthly_champion_${side}`] = monthly.map((m: any) => ({
            userId: m.user_id,
            visitCount: m.visit_count,
            rank: m.rank,
            firstName: m.first_name,
            lastName: m.last_name,
            customerNumber: m.customer_number
          }));
        }

        // 90-day leaderboard
        const { data: quarterly } = await supabase
          .rpc('get_top_bastare', { days: 90, limit_count: 10, side });

        if (quarterly) {
          boards[`quarterly_champion_${side}`] = quarterly.map((m: any) => ({
            userId: m.user_id,
            visitCount: m.visit_count,
            rank: m.rank,
            firstName: m.first_name,
            lastName: m.last_name,
            customerNumber: m.customer_number
          }));
        }

        // Time-based leaderboards
        const timeSlots = [
          { badge: 'morning_bird', start: 5, end: 9 },
          { badge: 'lunch_badare', start: 11, end: 14 },
          { badge: 'evening_bastare', start: 18, end: 20 },
          { badge: 'night_owl', start: 20, end: 22 }
        ];

        for (const slot of timeSlots) {
          const { data: timeBoard } = await supabase
            .rpc('get_time_based_leaderboard', {
              start_hour: slot.start,
              end_hour: slot.end,
              period_days: 30,
              limit_count: 10,
              side
            });

          if (timeBoard) {
            boards[`${slot.badge}_${side}`] = timeBoard.map((m: any) => ({
              userId: m.user_id,
              visitCount: m.visit_count,
              rank: m.rank,
              firstName: m.first_name,
              lastName: m.last_name,
              customerNumber: m.customer_number
            }));
          }
        }
      }

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
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Aktuell innehavare
                    </p>
                    <Link
                      to={`/members/${stats.holders[0].userId}`}
                      className="text-lg font-bold hover:underline"
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
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-6 w-6" />
              Utmärkelser & Priser
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Laddar prisdata...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderSideSection = (side: 'gents' | 'ladies') => {
    const sideName = side === 'gents' ? 'Herrsidan' : 'Damsidan';
    const sideEmoji = side === 'gents' ? '👔' : '👗';
    const sideBgColor = side === 'gents' ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-pink-50 dark:bg-pink-950/20';

    // Get all badges for this side
    const frequencyBadges = Object.entries(BADGE_DEFINITIONS)
      .filter(([type, _]) => type.endsWith(`_${side}`) && BADGE_DEFINITIONS[type].category === 'frequency');
    const timeBadges = Object.entries(BADGE_DEFINITIONS)
      .filter(([type, _]) => type.endsWith(`_${side}`) && BADGE_DEFINITIONS[type].category === 'time');
    const milestoneBadges = Object.entries(BADGE_DEFINITIONS)
      .filter(([type, _]) => type.endsWith(`_${side}`) && BADGE_DEFINITIONS[type].category === 'milestone');

    return (
      <Card className={sideBgColor}>
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
    <div className="p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-6 w-6" />
            Utmärkelser & Priser
          </CardTitle>
          <CardDescription>
            Badges separerade per avdelning - Herrsidan och Damsidan
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Two-column layout for sides */}
      <div className="grid gap-6 lg:grid-cols-2">
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
  );
}
