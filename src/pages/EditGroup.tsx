import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Group, DynamicGroupRule, RuleLogic } from '../types/groups';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { RuleBuilder } from '../components/groups/RuleBuilder';

export default function EditGroup() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState<DynamicGroupRule[]>([]);
  const [rulesLogic, setRulesLogic] = useState<RuleLogic>('AND');
  const [memberPreviewCount, setMemberPreviewCount] = useState<number>(0);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (id) {
      loadGroup();
    }
  }, [id]);

  useEffect(() => {
    // Update preview when rules change
    if (rules.length > 0) {
      updatePreview();
    } else {
      setMemberPreviewCount(0);
    }
  }, [rules, rulesLogic]);

  async function loadGroup() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('sms_groups')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) throw error;

      if (data.type !== 'dynamic') {
        alert('Endast dynamiska grupper kan redigeras');
        navigate(`/messages/groups/${id}`);
        return;
      }

      setGroup(data);
      setName(data.name);
      setDescription(data.description || '');
      setRulesLogic(data.rules?.logic || 'AND');
      setRules(data.rules?.rules || []);
    } catch (error) {
      console.error('Error loading group:', error);
      alert('Kunde inte ladda grupp');
      navigate('/messages/groups');
    } finally {
      setLoading(false);
    }
  }

  async function updatePreview() {
    try {
      setLoadingPreview(true);

      // Create temporary group to test rules
      const testRules = {
        logic: rulesLogic,
        rules: rules
      };

      // Save temporary rules to get count
    // @ts-expect-error - Declared but not used yet
      const { data: groupData, error: updateError } = await supabase
        .from('sms_groups')
        .update({ rules: testRules })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Resolve members to get count
      const { data: members, error: resolveError } = await supabase
        .rpc('resolve_dynamic_group_members', { group_id_param: id });

      if (resolveError) throw resolveError;

      setMemberPreviewCount(members?.length || 0);

      // Update member_count in database
      await supabase
        .from('sms_groups')
        .update({ member_count: members?.length || 0 })
        .eq('id', id);

    } catch (error) {
      console.error('Error updating preview:', error);
      setMemberPreviewCount(0);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      alert('Gruppnamn krävs');
      return;
    }

    if (rules.length === 0) {
      alert('Minst en regel krävs');
      return;
    }

    try {
      setSaving(true);

      const updates = {
        name: name.trim(),
        description: description.trim() || null,
        rules: {
          logic: rulesLogic,
          rules: rules
        },
        member_count: memberPreviewCount,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('sms_groups')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      navigate(`/messages/groups/${id}`);
    } catch (error) {
      console.error('Error saving group:', error);
      alert('Kunde inte spara gruppen');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!group) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/messages/groups/${id}`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">Redigera grupp</h1>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || rules.length === 0}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sparar...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" />Spara</>
            )}
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Basic info */}
        <Card>
          <CardHeader className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold">Grundinformation</h2>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gruppnamn *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="T.ex. Aktiva medlemmar"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beskrivning (valfritt)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Beskriv gruppen..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Rules */}
        <Card>
          <CardHeader className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold">Filter</h2>
          </CardHeader>
          <CardContent className="p-4">
            <RuleBuilder
              rules={rules}
              rulesLogic={rulesLogic}
              onRulesChange={setRules}
              onLogicChange={setRulesLogic}
            />
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-700">
                  Matchande medlemmar
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Medlemmar som uppfyller filtren
                </p>
              </div>
              <div className="text-right">
                {loadingPreview ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                ) : (
                  <p className="text-2xl font-bold text-purple-600">
                    {memberPreviewCount}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
