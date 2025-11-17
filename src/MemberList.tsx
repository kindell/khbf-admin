import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { type Member } from './lib/supabase';
import { type Period } from './App';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Search, Smartphone, CreditCard, ArrowUpDown, ArrowUp, ArrowDown, X, Trophy, ChevronDown } from 'lucide-react';
import { getMemberCategory, getCategoryBadgeVariant, getActivityStatus, getActivityBadgeVariant, type MemberCategory, type ActivityStatus } from './lib/member-categories';
import { MemberRow } from './components/ios/MemberRow';
import { SectionHeader } from './components/ios/SectionHeader';
import { IOSSearchBar } from './components/ios/IOSSearchBar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './components/ui/collapsible';
import { getBadgeInfo, getBadgeFullInfo, getCategoryDisplayName, getBadgeSortValue, getBadgeSideColor } from './lib/badge-info';

type SortField = 'customerNumber' | 'name' | 'visits' | 'age' | 'memberYears';
type SortDirection = 'asc' | 'desc';

const calculateAge = (personalIdentityNumber: string | null): number | null => {
  if (!personalIdentityNumber) return null;

  // Format: YYYYMMDD-XXXX or YYMMDD-XXXX
  const match = personalIdentityNumber.match(/^(\d{6}|\d{8})-?\d{4}$/);
  if (!match) return null;

  const dateStr = match[1];
  let year: number;
  let month: number;
  let day: number;

  if (dateStr.length === 8) {
    // YYYYMMDD
    year = parseInt(dateStr.substring(0, 4));
    month = parseInt(dateStr.substring(4, 6));
    day = parseInt(dateStr.substring(6, 8));
  } else {
    // YYMMDD
    const yy = parseInt(dateStr.substring(0, 2));
    // Assume 1900s if >= 30, otherwise 2000s
    year = yy >= 30 ? 1900 + yy : 2000 + yy;
    month = parseInt(dateStr.substring(2, 4));
    day = parseInt(dateStr.substring(4, 6));
  }

  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};

const calculateMemberYears = (member: Member, isQueueView: boolean = false): number | null => {
  // Determine the relevant date based on member type
  let relevantDate: string | null;

  if (isQueueView) {
    // For queue members: when they joined the queue
    // Priority: fortnox_customer_since (ideal) > first_queue_fee_date (first payment, best approximation)
    // Note: first_queue_fee_date is not perfect (they may have queued before paying first fee),
    // but it's the best approximation we have
    relevantDate = member.fortnox_customer_since
      || member.first_queue_fee_date;
  } else {
    // For regular members: Find the earliest date from available sources to determine membership start.
    // Priority: fortnox_customer_since (ideal) > last_entrance_fee_date (entrance fee) > last_annual_fee_date (annual fee fallback)
    // This matches the logic used in the badge system
    relevantDate = member.fortnox_customer_since || member.last_entrance_fee_date || member.last_annual_fee_date;
  }

  if (!relevantDate) return null;

  const startDate = new Date(relevantDate);
  const today = new Date();
  const years = today.getFullYear() - startDate.getFullYear();
  const monthDiff = today.getMonth() - startDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < startDate.getDate())) {
    return years - 1;
  }

  return years;
};

const calculateQueueDays = (member: Member): number | null => {
  // For queue members: when they joined the queue
  // Priority: fortnox_customer_since (ideal) > first_queue_fee_date (first payment, best approximation)
  const relevantDate = member.fortnox_customer_since || member.first_queue_fee_date;

  if (!relevantDate) return null;

  const startDate = new Date(relevantDate);
  const today = new Date();
  const diffMs = today.getTime() - startDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return days;
};

interface MemberListProps {
  members: Member[];
  period: Period;
  setPeriod: (period: Period) => void;
  search: string;
  setSearch: (search: string) => void;
}

export default function MemberList({
  members,
  period,
  // @ts-expect-error - Declared but not used yet
  setPeriod,
  search,
  setSearch,
}: MemberListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL or defaults
  const [selectedActivityStatuses, setSelectedActivityStatuses] = useState<Set<ActivityStatus>>(() => {
    const activityParam = searchParams.get('activity');
    if (activityParam) {
      const statuses = activityParam.split(',') as ActivityStatus[];
      return new Set(statuses);
    }
    return new Set(); // Empty = all
  });

  const [selectedCategories, setSelectedCategories] = useState<Set<MemberCategory>>(() => {
    const categoriesParam = searchParams.get('categories');
    if (categoriesParam) {
      const cats = categoriesParam.split(',').filter(c => c !== 'SPONSOR') as MemberCategory[];
      return new Set(cats);
    }
    return new Set(['MEDLEM', 'MEDBADARE']);
  });

  const [sortField, setSortField] = useState<SortField>(() => {
    return (searchParams.get('sort') as SortField) || 'visits';
  });

  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    return (searchParams.get('dir') as SortDirection) || 'desc';
  });

  const [selectedBadges, setSelectedBadges] = useState<Set<string>>(() => {
    const badgesParam = searchParams.get('badges');
    if (badgesParam) {
      const badges = badgesParam.split(',');
      return new Set(badges);
    }
    return new Set();
  });

  // Badge filter collapse state - auto-expand when any badge is selected
  const [badgeFiltersOpen, setBadgeFiltersOpen] = useState(() => {
    const badgesParam = searchParams.get('badges');
    return badgesParam !== null && badgesParam.length > 0;
  });

  // Initialize search from URL on mount
  useEffect(() => {
    const searchParam = searchParams.get('search');
    if (searchParam && searchParam !== search) {
      setSearch(searchParam);
    }
  }, []); // Only run on mount

  // Sync state to URL whenever it changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    // Activity status: only set if 1 selected (not both/none)
    if (selectedActivityStatuses.size === 1) {
      params.set('activity', Array.from(selectedActivityStatuses).join(','));
    } else {
      params.delete('activity');
    }

    // Categories: only set if some selected (not all/none)
    if (selectedCategories.size > 0 && selectedCategories.size < 4) {
      params.set('categories', Array.from(selectedCategories).join(','));
    } else {
      params.delete('categories');
    }

    // Badges: only set if some selected
    if (selectedBadges.size > 0) {
      params.set('badges', Array.from(selectedBadges).join(','));
    } else {
      params.delete('badges');
    }

    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }

    params.set('sort', sortField);
    params.set('dir', sortDirection);

    setSearchParams(params, { replace: true });
  }, [selectedActivityStatuses, selectedCategories, selectedBadges, search, sortField, sortDirection]);

  // Calculate category and activity status for each member
  const membersWithCategory = members.map(m => ({
    ...m,
    category: getMemberCategory(m),
    activityStatus: getActivityStatus(m)
  }));

  // Calculate counts for activity status (filtered by selected categories)
  const activityStatuses: { value: ActivityStatus; label: string; count: number }[] = [
    { value: 'active', label: 'Aktiv', count: 0 },
    { value: 'inactive', label: 'Inaktiv', count: 0 },
  ];

  // Step 1: Apply activity status filter first
  const activityFilteredMembers = membersWithCategory.filter(m => {
    if (selectedActivityStatuses.size === 0 || selectedActivityStatuses.size === 2) {
      return true; // All
    }
    return selectedActivityStatuses.has(m.activityStatus);
  });

  // Step 2: Apply category filter
  const categoryFilteredMembers = activityFilteredMembers.filter(m => {
    if (selectedCategories.size === 0 || selectedCategories.size === 4) {
      return true; // All
    }
    return selectedCategories.has(m.category);
  });

  // Step 3: Apply badge filter (AND logic: member must have ALL selected badges)
  const badgeFilteredMembers = categoryFilteredMembers.filter(m => {
    if (selectedBadges.size === 0) return true; // No badge filter

    // Member must have ALL selected badges
    return Array.from(selectedBadges).every(badgeType =>
      m.badges?.some(b => b.achievement_type === badgeType && b.is_active)
    );
  });

  // Step 4: Calculate badge counts FROM BADGE-FILTERED MEMBERS
  // This shows how many members with selected badges ALSO have each other badge
  const badgeCounts: Map<string, number> = new Map();
  badgeFilteredMembers.forEach(m => {
    m.badges?.forEach(badge => {
      if (badge.is_active) {
        badgeCounts.set(badge.achievement_type, (badgeCounts.get(badge.achievement_type) || 0) + 1);
      }
    });
  });

  // Sort badges by count (most popular first) and filter out badges with 0 count
  // Keep selected badges at the top of the list
  const availableBadges = Array.from(badgeCounts.entries())
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({
      type,
      count,
      info: getBadgeInfo(type),
      fullInfo: getBadgeFullInfo(type),
      isSelected: selectedBadges.has(type)
    }))
    .sort((a, b) => {
      // Selected badges first
      if (a.isSelected && !b.isSelected) return -1;
      if (!a.isSelected && b.isSelected) return 1;
      // Then by count
      return b.count - a.count;
    });

  // Sort badges by category (frequency → streak → time → milestone → anniversary → challenge)
  const categoryOrder: Record<string, number> = {
    'frequency': 1,
    'streak': 2,
    'time': 3,
    'milestone': 4,
    'anniversary': 5,
    'challenge': 6
  };

  const sortedBadges = [...availableBadges].sort((a, b) => {
    // Selected badges first
    if (a.isSelected && !b.isSelected) return -1;
    if (!a.isSelected && b.isSelected) return 1;

    // Then by category order
    const catA = categoryOrder[a.fullInfo?.category || 'other'] || 999;
    const catB = categoryOrder[b.fullInfo?.category || 'other'] || 999;
    if (catA !== catB) return catA - catB;

    // Finally by descending scale/prestige (higher values first)
    const valueA = getBadgeSortValue(a.type);
    const valueB = getBadgeSortValue(b.type);
    return valueB - valueA;
  });

  // Group badges by category for rendering
  const badgesByCategory = sortedBadges.reduce((acc, badge) => {
    const category = badge.fullInfo?.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(badge);
    return acc;
  }, {} as Record<string, typeof sortedBadges>);

  // Step 5: Count activity statuses FROM BADGE-FILTERED MEMBERS
  badgeFilteredMembers.forEach(m => {
    // Only count if member matches selected categories (or all selected)
    const matchesCategory = selectedCategories.size === 0 || selectedCategories.size === 4 || selectedCategories.has(m.category);

    if (matchesCategory) {
      const activity = activityStatuses.find(a => a.value === m.activityStatus);
      if (activity) activity.count++;
    }
  });

  // Step 6: Count categories FROM BADGE-FILTERED MEMBERS
  const categories: { value: MemberCategory; label: string; count: number }[] = [
    { value: 'MEDLEM', label: 'Medlem', count: 0 },
    { value: 'MEDBADARE', label: 'Medbadare', count: 0 },
    { value: 'KÖANDE', label: 'Köande', count: 0 },
    { value: 'INAKTIV', label: 'Inaktiv', count: 0 },
  ];

  badgeFilteredMembers.forEach(m => {
    // Only count if member matches selected activity statuses (or all selected)
    const matchesActivity = selectedActivityStatuses.size === 0 || selectedActivityStatuses.size === 2 || selectedActivityStatuses.has(m.activityStatus);

    if (matchesActivity) {
      const cat = categories.find(c => c.value === m.category);
      if (cat) cat.count++;
    }
  });

  const toggleActivityStatus = (status: ActivityStatus) => {
    const newSelected = new Set(selectedActivityStatuses);
    if (newSelected.has(status)) {
      newSelected.delete(status);
    } else {
      newSelected.add(status);
    }
    setSelectedActivityStatuses(newSelected);
  };

  const toggleCategory = (category: MemberCategory) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(category)) {
      newSelected.delete(category);
    } else {
      newSelected.add(category);
    }
    setSelectedCategories(newSelected);
  };

  const toggleBadge = (badgeType: string) => {
    const newSelected = new Set(selectedBadges);
    if (newSelected.has(badgeType)) {
      newSelected.delete(badgeType);
    } else {
      newSelected.add(badgeType);
      // Auto-expand when selecting a badge
      setBadgeFiltersOpen(true);
    }
    setSelectedBadges(newSelected);
  };

  const clearAllFilters = () => {
    setSelectedActivityStatuses(new Set());
    setSelectedCategories(new Set(['MEDLEM', 'MEDBADARE']));
    setSelectedBadges(new Set());
    setSearch('');
  };

  // Check if we're showing only queue members
  const isQueueView = selectedCategories.size === 1 && selectedCategories.has('KÖANDE');

  // Apply search filter
  const filteredMembers = badgeFilteredMembers.filter(m => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      m.fortnox_customer_number?.includes(searchLower) ||
      m.full_name?.toLowerCase().includes(searchLower) ||
      m.email?.toLowerCase().includes(searchLower) ||
      m.phone?.includes(searchLower)
    );
  });

  // Filter out duplicate members (same person with multiple customer numbers)
  // Keep only the newest customer number (highest number) for each unique person
  // IMPORTANT: Only deduplicate within the SAME category
  const deduplicatedMembers = (() => {
    const result: typeof filteredMembers = [];
    const processed = new Set<string>(); // Member IDs we've already handled

    filteredMembers.forEach(member => {
      if (processed.has(member.id)) return;

      // Find all members that represent the SAME PERSON (same personal identity number)
      // AND have the same category
      const duplicates = filteredMembers.filter(m => {
        if (m.id === member.id) return true;

        // CRITICAL: Only consider duplicates if they have the SAME category
        // This prevents KÖANDE members from being filtered out because they have
        // a duplicate with a higher customer number in MEDLEM category
        if (m.category !== member.category) return false;

        // Only deduplicate if they share the SAME personal identity number
        // This correctly handles cases like family members who share email/Parakey
        // but are different people with separate customer numbers and queue fees
        if (member.personal_identity_number && m.personal_identity_number &&
            member.personal_identity_number.trim() === m.personal_identity_number.trim()) {
          return true;
        }

        return false;
      });

      if (duplicates.length === 1) {
        // No duplicates, keep as is
        result.push(member);
        processed.add(member.id);
      } else {
        // Multiple members - keep only the one with highest customer number
        const sorted = duplicates
          .filter(m => m.fortnox_customer_number)
          .sort((a, b) => {
            const numA = parseInt(a.fortnox_customer_number || '0');
            const numB = parseInt(b.fortnox_customer_number || '0');
            return numB - numA; // Highest first
          });

        if (sorted.length > 0) {
          result.push(sorted[0]);
          // Mark all duplicates as processed
          duplicates.forEach(d => processed.add(d.id));
        }
      }
    });

    return result;
  })();

  // Sort members
  const sortedMembers = [...deduplicatedMembers].sort((a, b) => {
    // Special sorting for queue members (by fortnox_customer_since or first_queue_fee_date, oldest first = highest in queue)
    if (isQueueView) {
      const dateStrA = a.fortnox_customer_since || a.first_queue_fee_date;
      const dateStrB = b.fortnox_customer_since || b.first_queue_fee_date;
      const dateA = dateStrA ? new Date(dateStrA).getTime() : Infinity;
      const dateB = dateStrB ? new Date(dateStrB).getTime() : Infinity;
      return dateA - dateB; // Oldest first
    }

    let compareValue = 0;

    switch (sortField) {
      case 'customerNumber':
        const numA = parseInt(a.fortnox_customer_number || '0');
        const numB = parseInt(b.fortnox_customer_number || '0');
        compareValue = numA - numB;
        break;
      case 'name':
        compareValue = (a.full_name || '').localeCompare(b.full_name || '');
        break;
      case 'visits':
        if (period === 'week') compareValue = (b.visits_last_week || 0) - (a.visits_last_week || 0);
        else if (period === 'month') compareValue = (b.visits_last_month || 0) - (a.visits_last_month || 0);
        else compareValue = (b.visits_last_3_months || 0) - (a.visits_last_3_months || 0);
        break;
      case 'age':
        const ageA = calculateAge(a.personal_identity_number);
        const ageB = calculateAge(b.personal_identity_number);
        if (ageA === null && ageB === null) compareValue = 0;
        else if (ageA === null) compareValue = 1;
        else if (ageB === null) compareValue = -1;
        else compareValue = ageA - ageB;
        break;
      case 'memberYears':
        if (isQueueView) {
          // For queue view: sort by days in queue
          const daysA = calculateQueueDays(a);
          const daysB = calculateQueueDays(b);
          if (daysA === null && daysB === null) compareValue = 0;
          else if (daysA === null) compareValue = 1;
          else if (daysB === null) compareValue = -1;
          else compareValue = daysA - daysB;
        } else {
          // For regular view: sort by years as member
          const yearsA = calculateMemberYears(a, false);
          const yearsB = calculateMemberYears(b, false);
          if (yearsA === null && yearsB === null) compareValue = 0;
          else if (yearsA === null) compareValue = 1;
          else if (yearsB === null) compareValue = -1;
          else compareValue = yearsA - yearsB;
        }
        break;
    }

    return sortDirection === 'asc' ? compareValue : -compareValue;
  });

  // Generate dynamic page title based on selected categories
  const getPageTitle = () => {
    if (selectedCategories.size === 0) {
      return `Medlemmar (${sortedMembers.length})`;
    }

    const categoryLabels: Record<MemberCategory, string> = {
      'MEDLEM': 'Medlemmar',
      'MEDBADARE': 'Medbadare',
      'KÖANDE': 'Köande',
      'INAKTIV': 'Inaktiva'
    };

    const selectedLabels = Array.from(selectedCategories).map(cat => categoryLabels[cat]);

    if (selectedLabels.length === 1) {
      return `${selectedLabels[0]} (${sortedMembers.length})`;
    }

    return `${selectedLabels.join(', ')} (${sortedMembers.length})`;
  };
    // @ts-expect-error - Declared but not used yet
  const getVisitsForPeriod = (member: Member) => {
    if (period === 'week') return member.visits_last_week || 0;
    if (period === 'month') return member.visits_last_month || 0;
    return member.visits_last_3_months || 0;
  };
    // @ts-expect-error - Declared but not used yet
  const getPeriodLabel = () => {
    if (period === 'week') return '7 dagar';
    if (period === 'month') return '30 dagar';
    return '90 dagar';
  };

  const getPaymentBadges = (member: Member) => {
    const badges = [];
    if (member.last_queue_fee_date) badges.push('Köavgift');
    if (member.last_annual_fee_date) badges.push('Årsavgift');
    if (member.last_entrance_fee_date) badges.push('Inträde');
    return badges;
  };

  const getDisplayCategory = (member: Member & { category: MemberCategory }) => {
    return member.category;
  };

  const handleMemberClick = (member: Member) => {
    navigate(`/members/${member.id}`, { state: { animationDirection: 'forward' } });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if already sorting by this field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to descending for new field
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-30" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 ml-1 inline" />
      : <ArrowDown className="h-4 w-4 ml-1 inline" />;
  };

  return (
    <div className="space-y-4">
      {/* Activity Status filters */}
      <div className="px-4 lg:px-0">
        <div className="flex flex-wrap gap-2">
          {activityStatuses.map(({ value, label, count }) => {
            const isSelected = selectedActivityStatuses.has(value);
            return (
              <Badge
                key={value}
                variant={isSelected ? getActivityBadgeVariant(value) : 'outline'}
                className={`cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-offset-1' : 'opacity-60 hover:opacity-100'
                }`}
                onClick={() => toggleActivityStatus(value)}
              >
                {label} ({count})
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2 px-4 lg:px-0">
        {categories.map(({ value, label, count }) => {
          const isSelected = selectedCategories.has(value);
          return (
            <Badge
              key={value}
              variant={isSelected ? getCategoryBadgeVariant(value) : 'outline'}
              className={`cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-offset-1' : 'opacity-60 hover:opacity-100'
              }`}
              onClick={() => toggleCategory(value)}
            >
              {label} ({count})
            </Badge>
          );
        })}
      </div>

      {/* Badge filters */}
      {availableBadges.length > 0 && (
        <Collapsible
          open={badgeFiltersOpen}
          onOpenChange={setBadgeFiltersOpen}
          className="px-4 lg:px-0 space-y-2"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4" />
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-xs p-0 hover:bg-transparent">
                <span>Filtrera på utmärkelser</span>
                <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${badgeFiltersOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            {selectedBadges.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-6 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Rensa alla filter
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/members/prizes')}
              className="h-6 text-xs ml-auto"
            >
              <Trophy className="h-3 w-3 mr-1" />
              Visa priser & utmärkelser
            </Button>
          </div>

          <CollapsibleContent className="space-y-2">
            {/* Render badges grouped by category in specific order */}
            {['frequency', 'streak', 'time', 'milestone', 'anniversary', 'challenge'].map(category => {
              const badges = badgesByCategory[category];
              if (!badges || badges.length === 0) return null;

              return (
                <div key={category} className="flex items-start gap-2">
                  <div className="text-xs font-medium text-muted-foreground whitespace-nowrap pt-1.5">
                    {getCategoryDisplayName(category as any)}:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {badges.map(({ type, count, info, isSelected }) => (
                      <TooltipProvider key={type}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant={isSelected ? 'default' : 'outline'}
                              className={`cursor-pointer transition-all ${
                                isSelected ? 'ring-2 ring-offset-1' : 'opacity-60 hover:opacity-100'
                              }`}
                              onClick={() => toggleBadge(type)}
                            >
                              {info.emoji} {info.name} ({count})
                              {isSelected && <X className="h-3 w-3 ml-1 inline" />}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-semibold">{info.emoji} {info.name}</p>
                            <p className="text-xs text-muted-foreground">{info.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </div>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* iOS-style Search (mobile) */}
      <div className="lg:hidden">
        <IOSSearchBar
          value={search}
          onChange={setSearch}
          placeholder="Sök medlem..."
        />
      </div>

      {/* Desktop Search */}
      <div className="hidden lg:block relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Sök medlem (namn, email, telefon, kundnummer)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* iOS-style List (mobile) */}
      <div className="lg:hidden">
        <SectionHeader title={getPageTitle()} />
        <div className="bg-white border-y border-gray-200">
          {sortedMembers.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-[15px]">
              Inga medlemmar {search ? 'matchar sökningen' : 'hittades'}
            </div>
          ) : (
            sortedMembers.map((member, index) => (
              <MemberRow
                key={member.id}
                member={member}
                onClick={() => handleMemberClick(member)}
                queuePosition={isQueueView ? index + 1 : undefined}
                displayCategory={getDisplayCategory(member)}
              />
            ))
          )}
        </div>
      </div>

      {/* Desktop Table */}
      <Card className="hidden lg:block">
        <CardHeader>
          <CardTitle>{getPageTitle()}</CardTitle>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <Table>
            <TableHeader>
              <TableRow>
                {selectedCategories.size === 1 && selectedCategories.has('KÖANDE') && (
                  <TableHead className="w-16">#</TableHead>
                )}
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('customerNumber')}
                >
                  Kundnr
                  <SortIcon field="customerNumber" />
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('name')}
                >
                  Namn
                  <SortIcon field="name" />
                </TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Avgifter</TableHead>
                <TableHead>Badges</TableHead>
                {!isQueueView && <TableHead>Access</TableHead>}
                {!isQueueView && (
                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('visits')}
                  >
                    Besök (30 dagar)
                    <SortIcon field="visits" />
                  </TableHead>
                )}
                <TableHead
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('age')}
                >
                  Ålder
                  <SortIcon field="age" />
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('memberYears')}
                >
                  {selectedCategories.size === 1 && selectedCategories.has('KÖANDE') ? 'Dagar i kö' : 'År som medlem'}
                  <SortIcon field="memberYears" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMembers.map((member, index) => (
                <TableRow
                  key={member.id}
                  onClick={() => handleMemberClick(member)}
                  className="cursor-pointer"
                >
                  {selectedCategories.size === 1 && selectedCategories.has('KÖANDE') && (
                    <TableCell className="font-semibold text-muted-foreground">
                      {index + 1}
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-sm">{member.fortnox_customer_number}</TableCell>
                  <TableCell className="font-medium">{member.full_name}</TableCell>
                  <TableCell>
                    <Badge variant={getCategoryBadgeVariant(getDisplayCategory(member))}>
                      {getDisplayCategory(member)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {getPaymentBadges(member).map(badge => (
                        <Badge key={badge} variant="outline" className="text-xs">
                          {badge}
                        </Badge>
                      ))}
                      {getPaymentBadges(member).length === 0 && (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {member.badges && member.badges.length > 0 ? (
                        member.badges.map((badge: any) => {
                          const badgeInfo = getBadgeInfo(badge.achievement_type);
                          return (
                            <Tooltip key={badge.achievement_type} delayDuration={200}>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="secondary"
                                  className={`cursor-help px-2 py-1 ${getBadgeSideColor(badge.achievement_type)}`}
                                >
                                  <span className="text-lg">{badgeInfo.emoji}</span>
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">{badgeInfo.emoji}</span>
                                  <div>
                                    <div className="font-semibold">{badgeInfo.name}</div>
                                    <div className="text-xs text-muted-foreground">{badgeInfo.description}</div>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  {!isQueueView && (
                    <TableCell>
                      <div className="flex gap-1">
                        {member.parakey_user_id && (
                          <Smartphone className="h-4 w-4 text-muted-foreground"  />
                        )}
                        {member.aptus_user_id && (
                          <CreditCard className="h-4 w-4 text-muted-foreground"  />
                        )}
                      </div>
                    </TableCell>
                  )}
                  {!isQueueView && (
                    <TableCell className="text-right font-semibold">{member.visits_last_month || 0}</TableCell>
                  )}
                  <TableCell className="text-right">{calculateAge(member.personal_identity_number) ?? '-'}</TableCell>
                  <TableCell className="text-right">
                    {isQueueView
                      ? (calculateQueueDays(member) ?? '-')
                      : (calculateMemberYears(member, false) ?? '-')
                    }
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </TooltipProvider>

          {sortedMembers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Inga medlemmar {search ? 'matchar sökningen' : 'hittades'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
