import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { type Member } from './lib/supabase';
import { type Period } from './App';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Search, Smartphone, CreditCard, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { getMemberCategory, getCategoryBadgeVariant, type MemberCategory } from './lib/member-categories';

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
    // For regular members: ONLY use entrance fee date (when they became active members)
    // This is critical because many members queued first, and we want years as ACTIVE member
    relevantDate = member.last_entrance_fee_date;
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
  setPeriod,
  search,
  setSearch,
}: MemberListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL or defaults
  const [selectedCategories, setSelectedCategories] = useState<Set<MemberCategory>>(() => {
    const categoriesParam = searchParams.get('categories');
    if (categoriesParam) {
      const cats = categoriesParam.split(',') as MemberCategory[];
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

    if (selectedCategories.size > 0) {
      params.set('categories', Array.from(selectedCategories).join(','));
    } else {
      params.delete('categories');
    }

    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }

    params.set('sort', sortField);
    params.set('dir', sortDirection);

    setSearchParams(params, { replace: true });
  }, [selectedCategories, search, sortField, sortDirection]);

  const categories: { value: MemberCategory; label: string; count: number }[] = [
    { value: 'MEDLEM', label: 'Medlem', count: 0 },
    { value: 'MEDBADARE', label: 'Medbadare', count: 0 },
    { value: 'SPONSOR', label: 'Sponsor', count: 0 },
    { value: 'KÖANDE', label: 'Köande', count: 0 },
    { value: 'INAKTIV', label: 'Inaktiv', count: 0 },
  ];

  // Calculate category for each member
  const membersWithCategory = members.map(m => ({
    ...m,
    category: getMemberCategory(m)
  }));

  // Count members in each category
  membersWithCategory.forEach(m => {
    const cat = categories.find(c => c.value === m.category);
    if (cat) cat.count++;
  });

  const toggleCategory = (category: MemberCategory) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(category)) {
      newSelected.delete(category);
    } else {
      newSelected.add(category);
    }
    setSelectedCategories(newSelected);
  };

  // Check if we're showing only queue members
  const isQueueView = selectedCategories.size === 1 && selectedCategories.has('KÖANDE');

  // Apply category filter
  const viewFilteredMembers = membersWithCategory.filter(m => {
    return selectedCategories.size === 0 || selectedCategories.has(m.category);
  });

  // Apply search filter
  const filteredMembers = viewFilteredMembers.filter(m => {
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
      'SPONSOR': 'Sponsorer',
      'KÖANDE': 'Köande',
      'INAKTIV': 'Inaktiva'
    };

    const selectedLabels = Array.from(selectedCategories).map(cat => categoryLabels[cat]);

    if (selectedLabels.length === 1) {
      return `${selectedLabels[0]} (${sortedMembers.length})`;
    }

    return `${selectedLabels.join(', ')} (${sortedMembers.length})`;
  };

  const getVisitsForPeriod = (member: Member) => {
    if (period === 'week') return member.visits_last_week || 0;
    if (period === 'month') return member.visits_last_month || 0;
    return member.visits_last_3_months || 0;
  };

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
    // For sponsors, show their underlying category (MEDLEM or MEDBADARE)
    if (selectedCategories.size === 1 && selectedCategories.has('SPONSOR')) {
      // Check if they have paid membership fee
      const hasPaidMembershipFee = member.last_annual_fee_date || member.last_entrance_fee_date;
      if (hasPaidMembershipFee) return 'MEDLEM';
      if (member.parakey_user_id || member.aptus_user_id) return 'MEDBADARE';
    }
    return member.category;
  };

  const handleMemberClick = (member: Member) => {
    navigate(`/medlem/${member.id}`);
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
      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Sök medlem (namn, email, telefon, kundnummer)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>{getPageTitle()}</CardTitle>
        </CardHeader>
        <CardContent>
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
                  {!isQueueView && (
                    <TableCell>
                      <div className="flex gap-1">
                        {member.parakey_user_id && (
                          <Smartphone className="h-4 w-4 text-muted-foreground" title="Parakey" />
                        )}
                        {member.aptus_user_id && (
                          <CreditCard className="h-4 w-4 text-muted-foreground" title="RFID" />
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
