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
import { Search, ShieldAlert, ShieldX, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

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

interface Stats {
  deniedNoAccess: number;
  uniqueRFIDs: number;
  blockedUsers: number;
  outsideHours: number;
}

type TabType = 'unidentified' | 'blocked';
type TimeFilterType = '7' | '30' | '90';

export default function AptusOverview() {
  const [events, setEvents] = useState<AptusEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<AptusEvent[]>([]);
  const [stats, setStats] = useState<Stats>({
    deniedNoAccess: 0,
    uniqueRFIDs: 0,
    blockedUsers: 0,
    outsideHours: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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
    setLoading(false);
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

  function getStatusBadge(status: string) {
    switch (status) {
      case 'DENIED_NO_ACCESS':
        return <Badge variant="destructive">Nekad åtkomst</Badge>;
      case 'BLOCKED_USER':
        return <Badge variant="destructive">Blockerad</Badge>;
      case 'DENIED_OUTSIDE_HOURS':
        return <Badge variant="secondary">Utanför öppettider</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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

  // Count occurrences for RFID numbers
  function getRFIDCount(rfid: string | null) {
    if (!rfid) return 0;
    return events.filter(e => e.accesscredential === rfid).length;
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
                    <TableHead>Tidpunkt</TableHead>
                    {activeTab === 'blocked' && <TableHead>Användare</TableHead>}
                    {activeTab === 'blocked' && <TableHead>User ID</TableHead>}
                    <TableHead>Avdelning</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>RFID</TableHead>
                    {activeTab === 'unidentified' && <TableHead>Antal försök</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-mono text-sm">
                        {formatTimestamp(event.eventtime)}
                      </TableCell>
                      {activeTab === 'blocked' && (
                        <TableCell>{event.username || 'Okänd'}</TableCell>
                      )}
                      {activeTab === 'blocked' && (
                        <TableCell className="font-mono text-sm">
                          {event.userid || 'N/A'}
                        </TableCell>
                      )}
                      <TableCell>{getDepartmentBadge(event.department)}</TableCell>
                      <TableCell>{getEventTypeBadge(event.eventtype)}</TableCell>
                      <TableCell className="font-mono">
                        {event.accesscredential || 'N/A'}
                      </TableCell>
                      {activeTab === 'unidentified' && (
                        <TableCell>
                          <Badge variant="outline">
                            {getRFIDCount(event.accesscredential)}x
                          </Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
