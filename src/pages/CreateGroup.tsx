import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { GroupType, GroupMemberInfo, DynamicGroupRule, RuleLogic } from '../types/groups';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { MemberSelector } from '../components/groups/MemberSelector';
import { RuleBuilder } from '../components/groups/RuleBuilder';
import { supabase } from '../lib/supabase';

export default function CreateGroup() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<GroupType | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Static group state
  const [selectedMembers, setSelectedMembers] = useState<GroupMemberInfo[]>([]);

  // Dynamic group state
  const [rules, setRules] = useState<DynamicGroupRule[]>([]);
  const [rulesLogic, setRulesLogic] = useState<RuleLogic>('AND');
  const [previewMembers, setPreviewMembers] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showPreviewList, setShowPreviewList] = useState(false);

  const [isCreating, setIsCreating] = useState(false);

  // Load preview when rules change
  useEffect(() => {
    if (selectedType === 'dynamic') {
      loadPreviewMembers();
    } else {
      setPreviewMembers([]);
    }
  }, [rules, rulesLogic, selectedType]);

  async function loadPreviewMembers() {
    setLoadingPreview(true);
    try {
      // Create a temporary group to test the rules using the SQL function
      const { data: tempGroup, error: groupError } = await supabase
        .from('sms_groups')
        .insert({
          name: '__TEMP_PREVIEW__',
          type: 'dynamic',
          rules: {
            logic: rulesLogic,
            rules: rules
          }
        })
        .select()
        .single();

      if (groupError) {
        console.error('Error creating temp group:', groupError);
        setPreviewMembers([]);
        return;
      }

      // Use the RPC function to resolve members
      const { data: members, error: rpcError } = await supabase
        .rpc('resolve_dynamic_group_members', { group_id_param: tempGroup.id });

      // Delete the temporary group
      await supabase
        .from('sms_groups')
        .delete()
        .eq('id', tempGroup.id);

      if (rpcError) {
        console.error('Error resolving members:', rpcError);
        setPreviewMembers([]);
        return;
      }

      setPreviewMembers(members || []);
    } catch (error) {
      console.error('Error loading preview:', error);
      setPreviewMembers([]);
    } finally {
      setLoadingPreview(false);
    }
  }

  // Create static group
  async function createStaticGroup() {
    if (!name.trim() || selectedMembers.length === 0) {
      return;
    }

    setIsCreating(true);

    try {
      // 1. Create the group
      const { data: group, error: groupError } = await supabase
        .from('sms_groups')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          type: 'static',
          member_count: selectedMembers.length,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // 2. Add members to the group
      const memberInserts = selectedMembers.map(member => ({
        group_id: group.id,
        member_id: member.member_id,
      }));

      const { error: membersError } = await supabase
        .from('sms_group_members')
        .insert(memberInserts);

      if (membersError) throw membersError;

      // Success - navigate to the group detail page
      navigate(`/messages/groups/${group.id}`);
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Det gick inte att skapa gruppen. Försök igen.');
    } finally {
      setIsCreating(false);
    }
  }

  // Create dynamic group
  async function createDynamicGroup() {
    if (!name.trim() || rules.length === 0) {
      return;
    }

    setIsCreating(true);

    try {
      // Create the group with rules
      const { data: group, error: groupError } = await supabase
        .from('sms_groups')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          type: 'dynamic',
          rules: {
            logic: rulesLogic,
            rules: rules
          },
          rules_logic: rulesLogic,
          member_count: 0, // Will be updated by trigger or function
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Success - navigate to the group detail page
      navigate(`/messages/groups/${group.id}`);
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Det gick inte att skapa gruppen. Försök igen.');
    } finally {
      setIsCreating(false);
    }
  }

  const canCreateStatic = name.trim().length > 0 && selectedMembers.length > 0;
  const canCreateDynamic = name.trim().length > 0; // Rules can be empty (means "all")

  if (!selectedType) {
    // Step 1: Select group type
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/messages/groups')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">Ny grupp</h1>
          </div>
        </div>

        {/* Type selector */}
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Välj grupptyp</h2>

          <div className="space-y-3">
            {/* Static group option */}
            <Card
              className="cursor-pointer hover:border-blue-500 transition-colors"
              onClick={() => setSelectedType('static')}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                    👥
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">Fast grupp</h3>
                    <p className="text-sm text-gray-600">
                      Lägg till och ta bort medlemmar manuellt
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-gray-400">
                    →
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dynamic group option */}
            <Card
              className="cursor-pointer hover:border-purple-500 transition-colors"
              onClick={() => setSelectedType('dynamic')}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-2xl">
                    ⚡
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">Dynamisk grupp</h3>
                    <p className="text-sm text-gray-600">
                      Medlemmar väljs automatiskt baserat på regler
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-gray-400">
                    →
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Group creation form (static)
  if (selectedType === 'static') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedType(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-semibold">Ny fast grupp</h1>
            </div>
            <Button
              size="sm"
              disabled={!canCreateStatic || isCreating}
              onClick={createStaticGroup}
            >
              {isCreating ? 'Skapar...' : 'Skapa'}
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="p-4">
          <div className="space-y-6">
            {/* Group name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gruppnamn *
              </label>
              <input
                type="text"
                placeholder="t.ex. Styrelsen"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="
                  w-full px-4 py-2
                  border border-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  placeholder:text-gray-400
                "
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beskrivning (valfritt)
              </label>
              <textarea
                placeholder="Beskriv gruppen..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="
                  w-full px-4 py-2
                  border border-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  placeholder:text-gray-400
                  resize-none
                "
              />
            </div>

            {/* Members */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Medlemmar *
              </label>
              <MemberSelector
                selectedMembers={selectedMembers}
                onMembersChange={setSelectedMembers}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dynamic group form
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedType(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">Ny dynamisk grupp</h1>
          </div>
          <Button
            size="sm"
            disabled={!canCreateDynamic || isCreating}
            onClick={createDynamicGroup}
          >
            {isCreating ? 'Skapar...' : 'Skapa'}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="p-4">
        <div className="space-y-6">
          {/* Group name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gruppnamn *
            </label>
            <input
              type="text"
              placeholder="t.ex. Bastat senaste veckan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="
                w-full px-4 py-2
                border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500
                placeholder:text-gray-400
              "
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Beskrivning (valfritt)
            </label>
            <textarea
              placeholder="Beskriv gruppen..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="
                w-full px-4 py-2
                border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500
                placeholder:text-gray-400
                resize-none
              "
            />
          </div>

          {/* Rules */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Regler *
            </label>
            <RuleBuilder
              rules={rules}
              rulesLogic={rulesLogic}
              onRulesChange={setRules}
              onLogicChange={setRulesLogic}
            />
          </div>

          {/* Member preview - Always show */}
          <Card>
            <CardContent className="p-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowPreviewList(!showPreviewList)}
              >
                <div>
                  <h3 className="text-sm font-medium text-gray-700">
                    Matchande medlemmar
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {showPreviewList ? 'Klicka för att dölja' : 'Klicka för att visa'}
                  </p>
                </div>
                <div className="text-right">
                  {loadingPreview ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  ) : (
                    <p className="text-2xl font-bold text-purple-600">
                      {previewMembers.length}
                    </p>
                  )}
                </div>
              </div>

              {/* Member list */}
              {showPreviewList && previewMembers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-3">
                    Visar första 10 medlemmarna:
                  </p>
                  <div className="space-y-2">
                    {previewMembers.slice(0, 10).map((member: any) => (
                      <div
                        key={member.member_id}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-sm"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {member.first_name} {member.last_name}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {member.phone_number}
                          </div>
                          {(member.last_annual_fee_date || member.last_entrance_fee_date) && (
                            <div className="text-xs text-gray-500 mt-1">
                              Senaste avgift: {member.last_annual_fee_date || member.last_entrance_fee_date}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
