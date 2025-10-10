import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Member } from './lib/supabase';
import { type Period } from './App';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Search, Smartphone, CreditCard } from 'lucide-react';
import { getMemberCategory, getCategoryBadgeVariant, type MemberCategory } from './lib/member-categories';

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
  const [selectedCategories, setSelectedCategories] = useState<Set<MemberCategory>>(
    new Set(['MEDLEM', 'MEDBADARE'])
  );

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

  // Sort members
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    // Special sorting for queue members (by fortnox_customer_since)
    if (selectedCategories.size === 1 && selectedCategories.has('KÖANDE') &&
        a.fortnox_customer_since && b.fortnox_customer_since) {
      return new Date(a.fortnox_customer_since).getTime() - new Date(b.fortnox_customer_since).getTime();
    }

    // Default: sort by visits
    if (period === 'week') return (b.visits_last_week || 0) - (a.visits_last_week || 0);
    if (period === 'month') return (b.visits_last_month || 0) - (a.visits_last_month || 0);
    return (b.visits_last_3_months || 0) - (a.visits_last_3_months || 0);
  });

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
          <CardTitle>Medlemmar ({sortedMembers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {selectedCategories.size === 1 && selectedCategories.has('KÖANDE') && (
                  <TableHead className="w-16">#</TableHead>
                )}
                <TableHead>Kundnr</TableHead>
                <TableHead>Namn</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Avgifter</TableHead>
                <TableHead>Access</TableHead>
                <TableHead className="text-right">Besök (30 dagar)</TableHead>
                <TableHead className="text-right">Totalt</TableHead>
                <TableHead>Senaste besök</TableHead>
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
                  <TableCell className="text-muted-foreground">{member.email || '-'}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {member.phone ? (
                      <>
                        {member.phone_type === 'mobile' ? '📱 ' : member.phone_type === 'landline' ? '☎️ ' : ''}
                        {member.phone}
                      </>
                    ) : (
                      '-'
                    )}
                  </TableCell>
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
                    <div className="flex gap-1">
                      {member.parakey_user_id && (
                        <Smartphone className="h-4 w-4 text-muted-foreground" title="Parakey" />
                      )}
                      {member.aptus_user_id && (
                        <CreditCard className="h-4 w-4 text-muted-foreground" title="RFID" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{member.visits_last_month || 0}</TableCell>
                  <TableCell className="text-right">{member.visits_total || 0}</TableCell>
                  <TableCell>
                    {member.last_visit_at
                      ? new Date(member.last_visit_at).toLocaleDateString('sv-SE')
                      : '-'}
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
