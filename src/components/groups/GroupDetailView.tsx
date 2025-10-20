import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Trash2, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Group, GroupMember } from '../../types/groups';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';

export function GroupDetailView() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadGroupData();
    }
  }, [id]);

  async function loadGroupData() {
    try {
      setLoading(true);

      // Load group details
      const { data: groupData, error: groupError } = await supabase
        .from('sms_groups')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);

      // Load group members (only for static groups)
      if (groupData.type === 'static') {
        const { data: membersData, error: membersError } = await supabase
          .from('sms_group_members')
          .select(`
            id,
            group_id,
            member_id,
            added_at,
            member:members!inner (
              id,
              first_name,
              last_name,
              fortnox_customer_number,
              last_visit_at,
              visits_last_month
            )
          `)
          .eq('group_id', id)
          .order('added_at', { ascending: false });

        if (membersError) throw membersError;

        // Get phone numbers for members
        const memberIds = membersData?.map(m => m.member_id) || [];
        const { data: phoneData } = await supabase
          .from('phone_mappings')
          .select('member_id, phone_number')
          .in('member_id', memberIds)
          .eq('is_primary', true);

        // Create phone map
        const phoneMap = new Map<string, string>();
        phoneData?.forEach(p => {
          phoneMap.set(p.member_id, p.phone_number);
        });

        // Merge phone data with members
        const enrichedMembers: GroupMember[] = (membersData || []).map(m => {
          // Handle member data (Supabase returns it as an object or array with one item)
          const memberData = Array.isArray(m.member) ? m.member[0] : m.member;

          return {
            id: m.id,
            group_id: m.group_id,
            member_id: m.member_id,
            added_at: m.added_at,
            member: {
              id: memberData.id,
              first_name: memberData.first_name,
              last_name: memberData.last_name,
              fortnox_customer_number: memberData.fortnox_customer_number,
              phone_number: phoneMap.get(m.member_id),
              last_visit_at: memberData.last_visit_at,
              visits_last_month: memberData.visits_last_month,
            },
          };
        });

        setMembers(enrichedMembers);
      }
    } catch (error) {
      console.error('Error loading group:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteGroup() {
    if (!group) return;

    const confirmed = confirm(
      `Är du säker på att du vill ta bort gruppen "${group.name}"?`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('sms_groups')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', group.id);

      if (error) throw error;

      navigate('/messages/groups');
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Det gick inte att ta bort gruppen. Försök igen.');
    }
  }

  function handleSendMessage() {
    if (!group) return;
    // TODO: Navigate to new message with group pre-selected
    navigate(`/messages/new?group=${group.id}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Laddar grupp...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Gruppen hittades inte</p>
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => navigate('/messages/groups')}
          >
            Tillbaka till grupper
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/messages/groups')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div
                className={`
                  flex-shrink-0 w-8 h-8 rounded-full
                  flex items-center justify-center text-lg
                  ${group.type === 'static'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-purple-100 text-purple-600'
                  }
                `}
              >
                {group.type === 'static' ? '👥' : '⚡'}
              </div>
              <h1 className="text-xl font-semibold">{group.name}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Group info card */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Description */}
            {group.description && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Beskrivning
                </h3>
                <p className="text-sm text-gray-700">{group.description}</p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Typ
                </h3>
                <Badge variant="outline">
                  {group.type === 'static' ? 'Fast grupp' : 'Dynamisk grupp'}
                </Badge>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Medlemmar
                </h3>
                <p className="text-sm font-semibold text-gray-900">
                  {group.member_count || 0}
                </p>
              </div>
            </div>

            {/* Created date */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Skapad
              </h3>
              <p className="text-sm text-gray-700">{formatDate(group.created_at)}</p>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-gray-200 space-y-2">
              <Button
                className="w-full"
                onClick={handleSendMessage}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Skicka meddelande till gruppen
              </Button>
              <Button
                variant="outline"
                className="w-full text-red-600 border-red-300 hover:bg-red-50"
                onClick={handleDeleteGroup}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Ta bort grupp
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Members list (static groups only) */}
        {group.type === 'static' && members.length > 0 && (
          <Card>
            <CardHeader className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-600" />
                <h2 className="font-semibold text-gray-900">
                  Medlemmar ({members.length})
                </h2>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="
                    flex items-center gap-3 px-4 py-3
                    border-b border-gray-100 last:border-b-0
                  "
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-lg">👤</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900">
                      {member.member?.first_name} {member.member?.last_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {member.member?.fortnox_customer_number}
                      {member.member?.phone_number && ` • ${member.member.phone_number}`}
                    </div>
                  </div>
                  {member.member?.visits_last_month !== undefined && member.member.visits_last_month > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {member.member.visits_last_month} besök
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Dynamic group info */}
        {group.type === 'dynamic' && (
          <Card>
            <CardContent className="p-4">
              <div className="text-center text-sm text-gray-600">
                <p className="mb-2">
                  Dynamiska grupper uppdateras automatiskt baserat på regler
                </p>
                <p className="text-xs text-gray-500">
                  Regelbyggare kommer snart...
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
