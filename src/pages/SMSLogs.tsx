import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Search, Trash2, ArrowDown, ArrowUp, AlertCircle, RotateCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

interface SMSLog {
  id: string;
  direction: 'inbound' | 'outbound';
  phone_number: string;
  message: string;
  created_at: string;
  status: string;
  is_system: boolean;
  error_message?: string | null;
  retry_count?: number;
  member_name?: string | null;
}

export default function SMSLogs() {
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SMSLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'inbound' | 'outbound' | 'pending' | 'failed'>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    loadLogs();

    // Realtime updates
    const subscription = supabase
      .channel('sms_queue_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sms_queue' },
        () => loadLogs()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, search, filter]);

  async function loadLogs() {
    setLoading(true);
    const { data, error } = await supabase
      .from('sms_queue')
      .select(`
        id,
        direction,
        phone_number,
        message,
        created_at,
        status,
        is_system,
        error_message,
        retry_count,
        sms_threads (
          members (
            first_name,
            last_name
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Failed to load SMS logs:', error);
      setLoading(false);
      return;
    }

    const formattedLogs = data?.map((log: any) => ({
      ...log,
      member_name: log.sms_threads?.members
        ? `${log.sms_threads.members.first_name} ${log.sms_threads.members.last_name}`
        : null
    })) || [];

    setLogs(formattedLogs);
    setLoading(false);
  }

  function filterLogs() {
    let filtered = [...logs];

    // Filter by direction or status
    if (filter !== 'all') {
      if (filter === 'pending' || filter === 'failed') {
        // Filter by status
        filtered = filtered.filter(log => log.status === filter);
      } else if (filter === 'outbound') {
        // Filter by outbound with sent/delivered status only
        filtered = filtered.filter(log =>
          log.direction === 'outbound' && (log.status === 'sent' || log.status === 'delivered')
        );
      } else {
        // Filter by direction (inbound)
        filtered = filtered.filter(log => log.direction === filter);
      }
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(log =>
        log.message?.toLowerCase().includes(searchLower) ||
        log.phone_number?.toLowerCase().includes(searchLower) ||
        log.member_name?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredLogs(filtered);
  }

  async function clearLogs() {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      return;
    }

    const { error } = await supabase
      .from('sms_queue')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      console.error('Failed to clear logs:', error);
      alert('Kunde inte rensa loggen');
      return;
    }

    setShowClearConfirm(false);
    loadLogs();
  }

  async function retryMessage(id: string) {
    const { error } = await supabase
      .from('sms_queue')
      .update({
        status: 'pending',
        retry_count: 0,
        error_message: 'Manuell retry från admin'
      })
      .eq('id', id);

    if (error) {
      console.error('Failed to retry message:', error);
      alert('Kunde inte återförsöka meddelandet');
      return;
    }

    loadLogs();
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'sent': 'default',
      'delivered': 'default',
      'pending': 'secondary',
      'failed': 'destructive',
      'received': 'default'
    };

    return (
      <Badge variant={variants[status] || 'outline'} className="text-xs">
        {status}
      </Badge>
    );
  }

  const stats = {
    total: logs.length,
    inbound: logs.filter(l => l.direction === 'inbound').length,
    outbound: logs.filter(l => l.direction === 'outbound' && (l.status === 'sent' || l.status === 'delivered')).length,
    pending: logs.filter(l => l.status === 'pending').length,
    failed: logs.filter(l => l.status === 'failed').length
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">SMS Loggar</h1>
        <p className="text-muted-foreground">Historik över skickade och mottagna meddelanden</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Totalt</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.inbound}</div>
            <div className="text-xs text-muted-foreground">Mottagna</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.outbound}</div>
            <div className="text-xs text-muted-foreground">Skickade</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Väntande</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-xs text-muted-foreground">Misslyckade</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filter och Sök</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              size="sm"
            >
              Alla
            </Button>
            <Button
              variant={filter === 'inbound' ? 'default' : 'outline'}
              onClick={() => setFilter('inbound')}
              size="sm"
            >
              <ArrowDown className="h-4 w-4 mr-1" />
              Mottagna
            </Button>
            <Button
              variant={filter === 'outbound' ? 'default' : 'outline'}
              onClick={() => setFilter('outbound')}
              size="sm"
            >
              <ArrowUp className="h-4 w-4 mr-1" />
              Skickade
            </Button>
            <Button
              variant={filter === 'pending' ? 'default' : 'outline'}
              onClick={() => setFilter('pending')}
              size="sm"
            >
              <AlertCircle className="h-4 w-4 mr-1" />
              Väntande
            </Button>
            <Button
              variant={filter === 'failed' ? 'default' : 'outline'}
              onClick={() => setFilter('failed')}
              size="sm"
            >
              <AlertCircle className="h-4 w-4 mr-1" />
              Misslyckade
            </Button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Sök i meddelanden, telefonnummer eller namn..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant={showClearConfirm ? 'destructive' : 'outline'}
              onClick={clearLogs}
              onBlur={() => setTimeout(() => setShowClearConfirm(false), 200)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {showClearConfirm ? 'Bekräfta Rensa' : 'Rensa Logg'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle>Meddelanden ({filteredLogs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Inga meddelanden hittades
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-4 rounded-lg border ${
                    log.direction === 'inbound'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {log.direction === 'inbound' ? (
                          <ArrowDown className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowUp className="h-4 w-4 text-blue-600" />
                        )}
                        <span className="font-medium">
                          {log.member_name || log.phone_number}
                        </span>
                        {log.is_system && (
                          <Badge variant="secondary" className="text-xs">
                            System
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                        {log.message}
                      </p>
                      {log.status === 'failed' && log.error_message && (
                        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                          <span className="font-semibold">Fel:</span> {log.error_message}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {getStatusBadge(log.status)}
                      {log.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryMessage(log.id)}
                          className="text-xs h-7"
                        >
                          <RotateCw className="h-3 w-3 mr-1" />
                          Försök igen
                        </Button>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(log.created_at), {
                          addSuffix: true,
                          locale: sv
                        })}
                      </span>
                      {log.retry_count !== undefined && log.retry_count > 0 && (
                        <span className="text-xs text-orange-600">
                          {log.retry_count} försök
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showClearConfirm && (
        <div className="fixed bottom-4 right-4 bg-red-50 border-2 border-red-200 rounded-lg p-4 shadow-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <div className="font-semibold text-red-900">Klicka igen för att bekräfta</div>
              <div className="text-sm text-red-700">Detta raderar alla SMS-loggar permanent</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
