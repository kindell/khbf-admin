import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Group } from '../types/groups';
import { GroupCard } from '../components/groups/GroupCard';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export default function GroupsOverview() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadGroups();

    // Subscribe to group changes
    const subscription = supabase
      .channel('sms_groups_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sms_groups' },
        () => {
          loadGroups();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadGroups() {
    try {
      const { data, error } = await supabase
        .from('sms_groups')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setGroups(data || []);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const staticGroups = filteredGroups.filter(g => g.type === 'static');
  const dynamicGroups = filteredGroups.filter(g => g.type === 'dynamic');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Laddar grupper...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-semibold">Grupper</h1>
          <Button
            onClick={() => navigate('/messages/groups/new')}
            size="sm"
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Ny grupp
          </Button>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Sök grupper..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="
                w-full pl-10 pr-4 py-2
                bg-gray-100 rounded-lg
                text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500
                placeholder:text-gray-400
              "
            />
          </div>
        </div>
      </div>

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">👥</span>
          </div>
          <h2 className="text-lg font-semibold mb-2">Inga grupper än</h2>
          <p className="text-sm text-gray-600 text-center mb-6 max-w-xs">
            Skapa grupper för att skicka meddelanden till flera medlemmar samtidigt
          </p>
          <Button onClick={() => navigate('/messages/groups/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Skapa första gruppen
          </Button>
        </div>
      )}

      {/* Groups list */}
      {groups.length > 0 && (
        <div className="pb-6">
          {/* Static groups */}
          {staticGroups.length > 0 && (
            <div className="mt-6">
              <h2 className="px-4 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Fasta grupper
              </h2>
              <Card className="mx-4 overflow-hidden">
                <CardContent className="p-0">
                  {staticGroups.map(group => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      onClick={() => navigate(`/messages/groups/${group.id}`)}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Dynamic groups */}
          {dynamicGroups.length > 0 && (
            <div className="mt-6">
              <h2 className="px-4 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Dynamiska grupper
              </h2>
              <Card className="mx-4 overflow-hidden">
                <CardContent className="p-0">
                  {dynamicGroups.map(group => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      onClick={() => navigate(`/messages/groups/${group.id}`)}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* No results */}
          {filteredGroups.length === 0 && searchQuery && (
            <div className="text-center py-12 px-4">
              <p className="text-sm text-gray-600">
                Inga grupper matchar "{searchQuery}"
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
