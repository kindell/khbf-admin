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
import { Search, ShieldAlert, ShieldX, Clock, ArrowUpDown, ArrowUp, ArrowDown, UserCheck, ExternalLink, X, Plus } from 'lucide-react';
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

interface Filter {
  type: 'rfid' | 'department' | 'status' | 'eventtype';
  value: string;
  label: string;
}

type TimeFilterType = '7' | '30' | '90';
type SortField = 'eventtime' | 'username' | 'userid' | 'department' | 'eventtype' | 'accesscredential' | 'status';
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
  const [sortField, setSortField] = useState<SortField>('eventtime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('30');
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [newFilterType, setNewFilterType] = useState<'rfid' | 'department' | 'status' | 'eventtype'>('rfid');
  const [newFilterValue, setNewFilterValue] = useState('');

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
  }, [events, search, filters]);

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

    // Apply each filter
    filters.forEach(filter => {
      switch (filter.type) {
        case 'rfid':
          filtered = filtered.filter(e => e.accesscredential === filter.value);
          break;
        case 'department':
          filtered = filtered.filter(e => e.department === filter.value);
          break;
        case 'status':
          filtered = filtered.filter(e => e.status === filter.value);
          break;
        case 'eventtype':
          filtered = filtered.filter(e => e.eventtype === filter.value);
          break;
      }
    });

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

  function addFilter(type: Filter['type'], value: string, label: string) {
    // Don't add duplicate filters
    const exists = filters.some(f => f.type === type && f.value === value);
    if (!exists) {
      setFilters([...filters, { type, value, label }]);
    }
  }

  function removeFilter(index: number) {
    setFilters(filters.filter((_, i) => i !== index));
  }

  function handleAddCustomFilter() {
    if (!newFilterValue) return;

    let label = '';
    switch (newFilterType) {
      case 'rfid':
        label = `RFID: ${newFilterValue}`;
        break;
      case 'department':
        label = `Avdelning: ${newFilterValue === 'LADIES' ? 'Damer' : 'Herrar'}`;
        break;
      case 'status':
        label = `Status: ${getStatusLabel(newFilterValue)}`;
        break;
      case 'eventtype':
        label = `Typ: ${newFilterValue === 'DOOR' ? 'Dörr' : 'Registrering'}`;
        break;
    }

    addFilter(newFilterType, newFilterValue, label);
    setNewFilterValue('');
    setShowAddFilter(false);
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'DENIED_NO_ACCESS':
        return 'Nekad (ingen åtkomst)';
      case 'BLOCKED_USER':
        return 'Blockerad användare';
      case 'DENIED_OUTSIDE_HOURS':
        return 'Nekad (utanför öppettider)';
      default:
        return status;
    }
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

  function getDepartmentBadge(department: string, onClick?: () => void) {
    const label = department === 'LADIES' ? 'Damer' : 'Herrar';
    return (
      <Badge
        variant="secondary"
        className={onClick ? "cursor-pointer hover:bg-secondary/80" : ""}
        onClick={onClick}
      >
        {label}
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

  function getStatusBadge(status: string) {
    let variant: 'default' | 'destructive' | 'outline' | 'secondary' = 'secondary';
    if (status === 'BLOCKED_USER') variant = 'destructive';

    return (
      <Badge variant={variant}>
        {getStatusLabel(status)}
      </Badge>
    );
  }

  // Handle sort click
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'eventtime' ? 'desc' : 'asc');
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

  // Get sorted events
  function getSortedEvents() {
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
        case 'status':
          comparison = a.status.localeCompare(b.status);
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

      {/* Advanced Search & Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Sök namn, user ID eller RFID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Active filters */}
            {filters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filters.map((filter, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="flex items-center gap-1 px-3 py-1"
                  >
                    <span>{filter.label}</span>
                    <button
                      onClick={() => removeFilter(index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add filter section */}
            <div>
              {!showAddFilter ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddFilter(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Lägg till filter
                </Button>
              ) : (
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={newFilterType}
                        onChange={(e) => {
                          setNewFilterType(e.target.value as any);
                          setNewFilterValue('');
                        }}
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="rfid">RFID-nummer</option>
                        <option value="department">Avdelning</option>
                        <option value="status">Status</option>
                        <option value="eventtype">Händelsetyp</option>
                      </select>

                      {newFilterType === 'rfid' && (
                        <Input
                          placeholder="RFID-nummer..."
                          value={newFilterValue}
                          onChange={(e) => setNewFilterValue(e.target.value)}
                        />
                      )}

                      {newFilterType === 'department' && (
                        <select
                          value={newFilterValue}
                          onChange={(e) => setNewFilterValue(e.target.value)}
                          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm flex-1"
                        >
                          <option value="">Välj avdelning...</option>
                          <option value="LADIES">Damer</option>
                          <option value="GENTS">Herrar</option>
                        </select>
                      )}

                      {newFilterType === 'status' && (
                        <select
                          value={newFilterValue}
                          onChange={(e) => setNewFilterValue(e.target.value)}
                          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm flex-1"
                        >
                          <option value="">Välj status...</option>
                          <option value="DENIED_NO_ACCESS">Nekad (ingen åtkomst)</option>
                          <option value="BLOCKED_USER">Blockerad användare</option>
                          <option value="DENIED_OUTSIDE_HOURS">Nekad (utanför öppettider)</option>
                        </select>
                      )}

                      {newFilterType === 'eventtype' && (
                        <select
                          value={newFilterValue}
                          onChange={(e) => setNewFilterValue(e.target.value)}
                          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm flex-1"
                        >
                          <option value="">Välj typ...</option>
                          <option value="DOOR">Dörr</option>
                          <option value="REGISTRATION">Registrering</option>
                        </select>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddCustomFilter}
                    disabled={!newFilterValue}
                  >
                    Lägg till
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAddFilter(false);
                      setNewFilterValue('');
                    }}
                  >
                    Avbryt
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Access-händelser ({filteredEvents.length})
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
                    <SortableHeader field="eventtime">Tidpunkt</SortableHeader>
                    <SortableHeader field="accesscredential">RFID</SortableHeader>
                    <TableHead>Identifiering</TableHead>
                    <SortableHeader field="username">Användarnamn</SortableHeader>
                    <SortableHeader field="userid">User ID</SortableHeader>
                    <SortableHeader field="department">Avdelning</SortableHeader>
                    <SortableHeader field="eventtype">Typ</SortableHeader>
                    <SortableHeader field="status">Status</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getSortedEvents().map((event) => {
                    const identification = event.accesscredential ? rfidIdentifications.get(event.accesscredential) : null;

                    return (
                      <TableRow key={event.id}>
                        <TableCell className="font-mono text-sm">
                          {formatTimestamp(event.eventtime)}
                        </TableCell>
                        <TableCell>
                          {event.accesscredential ? (
                            <button
                              onClick={() => addFilter('rfid', event.accesscredential!, `RFID: ${event.accesscredential}`)}
                              className="font-mono font-medium hover:underline cursor-pointer text-blue-600 hover:text-blue-800"
                            >
                              {event.accesscredential}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {identification?.isIdentified ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 whitespace-nowrap">
                                <UserCheck className="h-3 w-3 mr-1" />
                                Identifierad
                              </Badge>
                              {identification.member && (
                                <Link
                                  to={`/medlem/${identification.member.id}`}
                                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                                >
                                  {identification.member.first_name} {identification.member.last_name}
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              )}
                            </div>
                          ) : event.status === 'DENIED_NO_ACCESS' ? (
                            <Badge variant="secondary">Oidentifierad</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>{event.username || 'Okänd'}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {event.userid && event.userid !== 'null' ? event.userid : '-'}
                        </TableCell>
                        <TableCell>
                          {getDepartmentBadge(event.department, () => {
                            const label = event.department === 'LADIES' ? 'Damer' : 'Herrar';
                            addFilter('department', event.department, `Avdelning: ${label}`);
                          })}
                        </TableCell>
                        <TableCell>{getEventTypeBadge(event.eventtype)}</TableCell>
                        <TableCell>{getStatusBadge(event.status)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
