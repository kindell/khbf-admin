import { useState, useEffect, useRef } from 'react';
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
import { Search, ShieldAlert, ShieldX, Clock, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, X, ShieldOff, Lock } from 'lucide-react';
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
  type: 'rfid' | 'department' | 'status' | 'eventtype' | 'text';
  value: string;
  label: string;
}

interface Suggestion {
  type: 'rfid' | 'department' | 'status' | 'eventtype';
  value: string;
  label: string;
  display: string;
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
  const [searchInput, setSearchInput] = useState('');
  const [sortField, setSortField] = useState<SortField>('eventtime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('30');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
  }, [events, filters]);

  // Generate suggestions based on search input
  useEffect(() => {
    if (!searchInput.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const input = searchInput.toLowerCase();
    const newSuggestions: Suggestion[] = [];

    // RFID suggestions
    const uniqueRFIDs = new Set(events.map(e => e.accesscredential).filter(Boolean));
    uniqueRFIDs.forEach(rfid => {
      if (rfid!.toLowerCase().includes(input)) {
        newSuggestions.push({
          type: 'rfid',
          value: rfid!,
          label: `RFID: ${rfid}`,
          display: `RFID: ${rfid}`,
        });
      }
    });

    // Department suggestions
    if ('damer'.includes(input) || 'ladies'.includes(input)) {
      newSuggestions.push({
        type: 'department',
        value: 'LADIES',
        label: 'Avdelning: Damer',
        display: 'Avdelning: Damer',
      });
    }
    if ('herrar'.includes(input) || 'gents'.includes(input)) {
      newSuggestions.push({
        type: 'department',
        value: 'GENTS',
        label: 'Avdelning: Herrar',
        display: 'Avdelning: Herrar',
      });
    }

    // Status suggestions
    if ('nekad'.includes(input) || 'denied'.includes(input) || 'no access'.includes(input)) {
      newSuggestions.push({
        type: 'status',
        value: 'DENIED_NO_ACCESS',
        label: 'Status: Nekad (ingen åtkomst)',
        display: 'Status: Nekad (ingen åtkomst)',
      });
    }
    if ('blockerad'.includes(input) || 'blocked'.includes(input)) {
      newSuggestions.push({
        type: 'status',
        value: 'BLOCKED_USER',
        label: 'Status: Blockerad',
        display: 'Status: Blockerad användare',
      });
    }
    if ('utanför'.includes(input) || 'öppettider'.includes(input) || 'outside'.includes(input) || 'hours'.includes(input)) {
      newSuggestions.push({
        type: 'status',
        value: 'DENIED_OUTSIDE_HOURS',
        label: 'Status: Utanför öppettider',
        display: 'Status: Nekad (utanför öppettider)',
      });
    }

    // Event type suggestions
    if ('dörr'.includes(input) || 'door'.includes(input)) {
      newSuggestions.push({
        type: 'eventtype',
        value: 'DOOR',
        label: 'Typ: Dörr',
        display: 'Händelsetyp: Dörr',
      });
    }
    if ('registrering'.includes(input) || 'registration'.includes(input)) {
      newSuggestions.push({
        type: 'eventtype',
        value: 'REGISTRATION',
        label: 'Typ: Registrering',
        display: 'Händelsetyp: Registrering',
      });
    }

    setSuggestions(newSuggestions.slice(0, 8)); // Limit to 8 suggestions
    setShowSuggestions(newSuggestions.length > 0);
    setSelectedSuggestionIndex(-1);
  }, [searchInput, events]);

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
        case 'text':
          const searchLower = filter.value.toLowerCase();
          filtered = filtered.filter(e =>
            e.accesscredential?.includes(filter.value) ||
            e.username?.toLowerCase().includes(searchLower) ||
            e.userid?.includes(filter.value)
          );
          break;
      }
    });

    setFilteredEvents(filtered);
  }

  function addFilter(filter: Filter) {
    // Don't add duplicate filters
    const exists = filters.some(f => f.type === filter.type && f.value === filter.value);
    if (!exists) {
      setFilters([...filters, filter]);
    }
  }

  function removeFilter(index: number) {
    setFilters(filters.filter((_, i) => i !== index));
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();

      if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
        // Add selected suggestion
        handleSelectSuggestion(suggestions[selectedSuggestionIndex]);
      } else if (searchInput.trim()) {
        // Add as text filter
        addFilter({
          type: 'text',
          value: searchInput.trim(),
          label: searchInput.trim(),
        });
        setSearchInput('');
        setShowSuggestions(false);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  }

  function handleSelectSuggestion(suggestion: Suggestion) {
    addFilter({
      type: suggestion.type,
      value: suggestion.value,
      label: suggestion.label,
    });
    setSearchInput('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    searchInputRef.current?.focus();
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'DENIED_NO_ACCESS':
        return 'Nekad';
      case 'BLOCKED_USER':
        return 'Blockerad';
      case 'DENIED_OUTSIDE_HOURS':
        return 'Stängt';
      default:
        return status;
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'DENIED_NO_ACCESS':
        return <ShieldOff className="h-4 w-4" />;
      case 'BLOCKED_USER':
        return <Lock className="h-4 w-4" />;
      case 'DENIED_OUTSIDE_HOURS':
        return <Clock className="h-4 w-4" />;
      default:
        return null;
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
    });
  }

  function formatCompactTimestamp(timestamp: string) {
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString('sv-SE', {
      timeZone: 'Europe/Stockholm',
      month: '2-digit',
      day: '2-digit',
    });
    const timeStr = date.toLocaleTimeString('sv-SE', {
      timeZone: 'Europe/Stockholm',
      hour: '2-digit',
      minute: '2-digit',
    });
    return { date: dateStr, time: timeStr };
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
      <div className="flex items-center gap-2">
        {getStatusIcon(status)}
        <Badge variant={variant}>
          {getStatusLabel(status)}
        </Badge>
      </div>
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

      {/* Autosuggest Search with Chips */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {/* Search input with chips */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
              <div className="min-h-[42px] flex flex-wrap items-center gap-1.5 border rounded-md pl-9 pr-3 py-1.5 focus-within:ring-2 focus-within:ring-ring">
                {/* Filter chips */}
                {filters.map((filter, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="flex items-center gap-1 px-2 py-1"
                  >
                    <span className="text-xs">{filter.label}</span>
                    <button
                      onClick={() => removeFilter(index)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {/* Search input */}
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => searchInput && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder={filters.length === 0 ? "Sök eller välj filter..." : ""}
                  className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
                />
              </div>

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.type}-${suggestion.value}`}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                        index === selectedSuggestionIndex ? 'bg-accent' : ''
                      }`}
                    >
                      {suggestion.display}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Hint text */}
            <p className="text-xs text-muted-foreground">
              Börja skriva för att få förslag, eller klicka på RFID/avdelning i tabellen
            </p>
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
                    <SortableHeader field="status">Status</SortableHeader>
                    <SortableHeader field="username">Användarnamn</SortableHeader>
                    <SortableHeader field="accesscredential">RFID</SortableHeader>
                    <SortableHeader field="userid">User ID</SortableHeader>
                    <SortableHeader field="department">Avdelning</SortableHeader>
                    <SortableHeader field="eventtype">Typ</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getSortedEvents().map((event) => {
                    const identification = event.accesscredential ? rfidIdentifications.get(event.accesscredential) : null;
                    const member = identification?.member;
                    const { date, time } = formatCompactTimestamp(event.eventtime);

                    return (
                      <TableRow key={event.id}>
                        <TableCell className="font-mono text-sm whitespace-nowrap">
                          <div className="flex flex-col">
                            <span>{date}</span>
                            <span className="text-muted-foreground">{time}</span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {getStatusBadge(event.status)}
                        </TableCell>
                        <TableCell>
                          {member ? (
                            <Link
                              to={`/medlem/${member.id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {event.username || 'Okänd'}
                            </Link>
                          ) : (
                            <span>{event.username || 'Okänd'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {event.accesscredential ? (
                            <button
                              onClick={() => addFilter({
                                type: 'rfid',
                                value: event.accesscredential!,
                                label: `RFID: ${event.accesscredential}`,
                              })}
                              className="font-mono font-medium hover:underline cursor-pointer text-blue-600 hover:text-blue-800"
                            >
                              {event.accesscredential}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {event.userid && event.userid !== 'null' ? event.userid : '-'}
                        </TableCell>
                        <TableCell>
                          {getDepartmentBadge(event.department, () => {
                            const label = event.department === 'LADIES' ? 'Damer' : 'Herrar';
                            addFilter({
                              type: 'department',
                              value: event.department,
                              label: `Avdelning: ${label}`,
                            });
                          })}
                        </TableCell>
                        <TableCell>{getEventTypeBadge(event.eventtype)}</TableCell>
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
