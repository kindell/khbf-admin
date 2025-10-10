import { useNavigate } from 'react-router-dom';
import { type Member } from './lib/supabase';
import { type Period } from './App';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Search } from 'lucide-react';

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

  // Show all members for now
  const activeMembers = members;

  // Apply search filter
  const filteredMembers = activeMembers.filter(m => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      m.fortnox_customer_number?.includes(searchLower) ||
      m.full_name?.toLowerCase().includes(searchLower) ||
      m.email?.toLowerCase().includes(searchLower) ||
      m.phone?.includes(searchLower)
    );
  });

  // Sort by visits in selected period
  const sortedMembers = [...filteredMembers].sort((a, b) => {
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

  const handleMemberClick = (member: Member) => {
    navigate(`/medlem/${member.id}`);
  };

  return (
    <div className="space-y-4">
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
                <TableHead>Kundnr</TableHead>
                <TableHead>Namn</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Besök (30 dagar)</TableHead>
                <TableHead className="text-right">Totalt</TableHead>
                <TableHead>Senaste besök</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMembers.map((member) => (
                <TableRow
                  key={member.id}
                  onClick={() => handleMemberClick(member)}
                  className="cursor-pointer"
                >
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
                    <Badge variant={member.status === 'SENIOR' ? 'secondary' : 'default'}>
                      {member.status}
                    </Badge>
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
