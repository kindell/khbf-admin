import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Search, ShieldAlert, ShieldX, Clock, ArrowUpDown, ArrowUp, ArrowDown, UserCheck, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AptusEvent {
  id: string;
  eventtime: string;
  userid: string | null;
  username: string;
  department: 'LADIES' | 'GENTS';
  eventtype: 'DOOR' | 'REGISTRATION';
  status: 'DENIED_NO_ACCESS' | 'BLOCKED_USER' | 'DENIED_OUTSIDE_HOURS';
  accesscredential: string | null;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  aptus_user_id: string;
  status: string;
}

interface RFIDIdentification {
  rfid: string;
  isIdentified: boolean;
  userid: string | null;
  member: Member | null;
}

interface Stats {
  deniedNoAccess: number;
  uniqueRFIDs: number;
  blockedUsers: number;
  outsideHours: number;
}

type TabType = 'unidentified' | 'blocked';
type TimeFilterType = '7' | '30' | '90';
type SortField = 'rfid' | 'count' | 'firstAttempt' | 'lastAttempt' | 'department' | 'eventtype' | 'eventtime' | 'username' | 'userid' | 'accesscredential';
type SortDirection = 'asc' | 'desc';

export default function AptusOverview() {
  const [events, setEvents] = useState<AptusEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<AptusEvent[]>([]);
  const [rfidIdentifications, setRfidIdentifications] = useState<Map<string, RFIDIdentification>>(new Map());
  const [stats, setStats] = useState<Stats>({
    deniedNoAccess: 0,
    uniqueRFIDs: 0,
    blockedUsers: 0,
    outsideHours: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('count');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [activeTab, setActiveTab] = useState<TabType>('unidentified');
  const [departmentFilter, setDepartmentFilter] = useState<'ALL' | 'LADIES' | 'GENTS'>('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState<'ALL' | 'DOOR' | 'REGISTRATION'>('ALL');
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('30');

  useEffect(() => {
    loadEvents();

    // Realtime updates
    const subscription = supabase
      .channel('aptus_events')
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: 'status=in.(DENIED_NO_ACCESS,BLOCKED_USER,DENIED_OUTSIDE_HOURS)'
        },
        () => loadEvents()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [timeFilter]);

  useEffect(() => {
    filterEvents();
  }, [events, search, activeTab, departmentFilter, eventTypeFilter]);

  // Reset sort when changing tabs
  useEffect(() => {
    if (activeTab === 'unidentified') {
      setSortField('count');
      setSortDirection('desc');
    } else {
      setSortField('eventtime');
      setSortDirection('desc');
    }
  }, [activeTab]);

  async function loadEvents() {
    setLoading(true);

    const daysBack = parseInt(timeFilter);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const { data, error } = await supabase
      .from('events')
      .select('id, eventtime, userid, username, department, eventtype, status, accesscredential')
      .in('status', ['DENIED_NO_ACCESS', 'BLOCKED_USER', 'DENIED_OUTSIDE_HOURS'])
      .gte('eventtime', startDate.toISOString())
      .order('eventtime', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Failed to load events:', error);
      setLoading(false);
      return;
    }

    setEvents(data || []);
    calculateStats(data || []);

    // Check if any denied RFID numbers have been identified later
    await checkRFIDIdentifications(data || []);

    setLoading(false);
  }

  async function checkRFIDIdentifications(eventsData: AptusEvent[]) {
    // Get all unique RFID numbers from DENIED_NO_ACCESS events
    const deniedRFIDs = new Set(
      eventsData
        .filter(e => e.status === 'DENIED_NO_ACCESS' && e.accesscredential)
        .map(e => e.accesscredential!)
    );

    if (deniedRFIDs.size === 0) {
      return;
    }

    // Check if any of these RFIDs appear in events with a member_id
    const { data: identifiedEvents, error: eventsError } = await supabase
      .from('events')
      .select('accesscredential, userid, member_id')
      .in('accesscredential', Array.from(deniedRFIDs))
      .not('member_id', 'is', null)
      .order('eventtime', { ascending: false });

    if (eventsError) {
      console.error('Failed to check RFID identifications:', eventsError);
      return;
    }

    // Get unique member_id values
    const memberIds = new Set(
      (identifiedEvents || [])
        .map(e => e.member_id)
        .filter(id => id)
    );

    // Fetch member information for these member_ids
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, first_name, last_name, aptus_user_id, status')
      .in('id', Array.from(memberIds));

    if (membersError) {
      console.error('Failed to fetch members:', membersError);
    }

    // Create a map of member_id -> member
    const membersByMemberId = new Map<string, Member>();
    (members || []).forEach(member => {
      membersByMemberId.set(member.id, member);
    });

    // Build RFID identification map
    const identMap = new Map<string, RFIDIdentification>();

    (identifiedEvents || []).forEach(event => {
      if (!event.accesscredential || !event.member_id) {
        return;
      }

      // Only add if not already added (we want the latest one)
      if (!identMap.has(event.accesscredential)) {
        identMap.set(event.accesscredential, {
          rfid: event.accesscredential,
          isIdentified: true,
          userid: event.userid || null,
          member: membersByMemberId.get(event.member_id) || null,
        });
      }
    });

    setRfidIdentifications(identMap);
  }

  function calculateStats(eventsData: AptusEvent[]) {
    const deniedNoAccess = eventsData.filter(e => e.status === 'DENIED_NO_ACCESS').length;
    const uniqueRFIDs = new Set(
      eventsData
        .filter(e => e.status === 'DENIED_NO_ACCESS' && e.accesscredential)
        .map(e => e.accesscredential)
    ).size;
    const blockedUsers = eventsData.filter(e => e.status === 'BLOCKED_USER').length;
    const outsideHours = eventsData.filter(e => e.status === 'DENIED_OUTSIDE_HOURS').length;

    setStats({
      deniedNoAccess,
      uniqueRFIDs,
      blockedUsers,
      outsideHours,
    });
  }

  function filterEvents() {
    let filtered = [...events];

    // Filter by tab (status)
    if (activeTab === 'unidentified') {
      filtered = filtered.filter(e => e.status === 'DENIED_NO_ACCESS');
    } else if (activeTab === 'blocked') {
      filtered = filtered.filter(e => e.status === 'BLOCKED_USER');
    }

    // Filter by department
    if (departmentFilter !== 'ALL') {
      filtered = filtered.filter(e => e.department === departmentFilter);
    }

    // Filter by event type
    if (eventTypeFilter !== 'ALL') {
      filtered = filtered.filter(e => e.eventtype === eventTypeFilter);
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(e =>
        e.accesscredential?.includes(search) ||
        e.username?.toLowerCase().includes(searchLower) ||
        e.userid?.includes(search)
      );
    }

    setFilteredEvents(filtered);
  }

  function formatTimestamp(timestamp: string) {
    const date = new Date(timestamp);
    return date.toLocaleString('sv-SE', {
      timeZone: 'Europe/Stockholm',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function getDepartmentBadge(department: string) {
    return (
      <Badge variant={department === 'LADIES' ? 'default' : 'secondary'}>
        {department === 'LADIES' ? 'Damer' : 'Herrar'}
      </Badge>
    );
  }

  function getEventTypeBadge(eventtype: string) {
    return (
      <Badge variant="outline">
        {eventtype === 'DOOR' ? 'Dörr' : 'Registrering'}
      </Badge>
    );
  }

  // Handle sort click
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'count' ? 'desc' : 'asc');
    }
  }

  // Sortable header component
  function SortableHeader({ field, children }: { field: SortField; children: React.ReactNode }) {
    const isActive = sortField === field;
    return (
      <TableHead>
        <button
          onClick={() => handleSort(field)}
          className="flex items-center gap-1 hover:text-foreground transition-colors font-medium"
        >
          {children}
          {isActive ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )
          ) : (
            <ArrowUpDown className="h-4 w-4 opacity-0 group-hover:opacity-50" />
          )}
        </button>
      </TableHead>
    );
  }

  // Group events by RFID for unidentified tab
  function getGroupedRFIDData() {
    const rfidMap = new Map<string, AptusEvent[]>();

    filteredEvents.forEach(event => {
      if (!event.accesscredential) return;

      const existing = rfidMap.get(event.accesscredential) || [];
      existing.push(event);
      rfidMap.set(event.accesscredential, existing);
    });

    const grouped = Array.from(rfidMap.entries()).map(([rfid, events]) => {
      // Sort by time to get first and last
      const sorted = events.sort((a, b) =>
        new Date(a.eventtime).getTime() - new Date(b.eventtime).getTime()
      );

      // Get most common department and eventtype
      const deptCounts = new Map<string, number>();
      const typeCounts = new Map<string, number>();

      events.forEach(e => {
        deptCounts.set(e.department, (deptCounts.get(e.department) || 0) + 1);
        typeCounts.set(e.eventtype, (typeCounts.get(e.eventtype) || 0) + 1);
      });

      const mostCommonDept = Array.from(deptCounts.entries())
        .sort((a, b) => b[1] - a[1])[0][0];
      const mostCommonType = Array.from(typeCounts.entries())
        .sort((a, b) => b[1] - a[1])[0][0];

      return {
        rfid,
        count: events.length,
        firstAttempt: sorted[0].eventtime,
        lastAttempt: sorted[sorted.length - 1].eventtime,
        department: mostCommonDept as 'LADIES' | 'GENTS',
        eventtype: mostCommonType as 'DOOR' | 'REGISTRATION',
      };
    });

    // Apply sorting
    return grouped.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'rfid':
          comparison = a.rfid.localeCompare(b.rfid);
          break;
        case 'count':
          comparison = a.count - b.count;
          break;
        case 'firstAttempt':
          comparison = new Date(a.firstAttempt).getTime() - new Date(b.firstAttempt).getTime();
          break;
        case 'lastAttempt':
          comparison = new Date(a.lastAttempt).getTime() - new Date(b.lastAttempt).getTime();
          break;
        case 'department':
          comparison = a.department.localeCompare(b.department);
          break;
        case 'eventtype':
          comparison = a.eventtype.localeCompare(b.eventtype);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  // Get sorted blocked events
  function getSortedBlockedEvents() {
    return [...filteredEvents].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'eventtime':
          comparison = new Date(a.eventtime).getTime() - new Date(b.eventtime).getTime();
          break;
        case 'username':
          comparison = (a.username || '').localeCompare(b.username || '');
          break;
        case 'userid':
          comparison = (a.userid || '').localeCompare(b.userid || '');
          break;
        case 'department':
          comparison = a.department.localeCompare(b.department);
          break;
        case 'eventtype':
          comparison = a.eventtype.localeCompare(b.eventtype);
          break;
        case 'accesscredential':
          comparison = (a.accesscredential || '').localeCompare(b.accesscredential || '');
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Aptus Access-hantering</h1>
        <p className="text-muted-foreground mt-2">
          Hantera nekade access-försök och blockerade användare
        </p>
      </div>

      {/* Time Filter */}
      <div className="flex gap-2">
        <Button
          variant={timeFilter === '7' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTimeFilter('7')}
        >
          7 dagar
        </Button>
        <Button
          variant={timeFilter === '30' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTimeFilter('30')}
        >
          30 dagar
        </Button>
        <Button
          variant={timeFilter === '90' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTimeFilter('90')}
        >
          90 dagar
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nekade försök</CardTitle>
            <ShieldX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deniedNoAccess}</div>
            <p className="text-xs text-muted-foreground">
              Senaste {timeFilter} dagarna
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unika RFID</CardTitle>
            <ShieldX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueRFIDs}</div>
            <p className="text-xs text-muted-foreground">
              Okända RFID-nummer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blockerade</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.blockedUsers}</div>
            <p className="text-xs text-muted-foreground">
              Försök från blockerade
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utanför öppettider</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.outsideHours}</div>
            <p className="text-xs text-muted-foreground">
              Försök vid stängt
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'unidentified'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('unidentified')}
        >
          Icke identifierade RFID ({stats.deniedNoAccess})
        </button>
        <button
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'blocked'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('blocked')}
        >
          Blockerade användare ({stats.blockedUsers})
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={activeTab === 'unidentified' ? 'Sök RFID-nummer...' : 'Sök namn, user ID eller RFID...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value as any)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="ALL">Alla avdelningar</option>
                <option value="LADIES">Damer</option>
                <option value="GENTS">Herrar</option>
              </select>
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value as any)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="ALL">Alla typer</option>
                <option value="DOOR">Dörr</option>
                <option value="REGISTRATION">Registrering</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {activeTab === 'unidentified' ? 'Icke identifierade RFID-försök' : 'Blockerade användare'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Laddar...</div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Inga händelser hittades
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {activeTab === 'unidentified' ? (
                      <>
                        <SortableHeader field="rfid">RFID-nummer</SortableHeader>
                        <TableHead>Status</TableHead>
                        <SortableHeader field="count">Antal försök</SortableHeader>
                        <SortableHeader field="firstAttempt">Första försök</SortableHeader>
                        <SortableHeader field="lastAttempt">Senaste försök</SortableHeader>
                        <SortableHeader field="department">Avdelning</SortableHeader>
                        <SortableHeader field="eventtype">Typ</SortableHeader>
                      </>
                    ) : (
                      <>
                        <SortableHeader field="eventtime">Tidpunkt</SortableHeader>
                        <SortableHeader field="username">Användare</SortableHeader>
                        <SortableHeader field="userid">User ID</SortableHeader>
                        <SortableHeader field="department">Avdelning</SortableHeader>
                        <SortableHeader field="eventtype">Typ</SortableHeader>
                        <SortableHeader field="accesscredential">RFID</SortableHeader>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeTab === 'unidentified' ? (
                    getGroupedRFIDData().map((item) => {
                      const identification = rfidIdentifications.get(item.rfid);
                      return (
                        <TableRow key={item.rfid}>
                          <TableCell className="font-mono font-medium">
                            {item.rfid}
                          </TableCell>
                          <TableCell>
                            {identification?.isIdentified ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  <UserCheck className="h-3 w-3 mr-1" />
                                  Identifierad
                                </Badge>
                                {identification.member ? (
                                  <Link
                                    to={`/medlem/${identification.member.id}`}
                                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {identification.member.first_name} {identification.member.last_name}
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    (User ID: {identification.userid})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Badge variant="secondary">Oidentifierad</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive">
                              {item.count}x
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatTimestamp(item.firstAttempt)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatTimestamp(item.lastAttempt)}
                          </TableCell>
                          <TableCell>{getDepartmentBadge(item.department)}</TableCell>
                          <TableCell>{getEventTypeBadge(item.eventtype)}</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    getSortedBlockedEvents().map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-mono text-sm">
                          {formatTimestamp(event.eventtime)}
                        </TableCell>
                        <TableCell>{event.username || 'Okänd'}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {event.userid && event.userid !== 'null' ? event.userid : '-'}
                        </TableCell>
                        <TableCell>{getDepartmentBadge(event.department)}</TableCell>
                        <TableCell>{getEventTypeBadge(event.eventtype)}</TableCell>
                        <TableCell className="font-mono">
                          {event.accesscredential || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
