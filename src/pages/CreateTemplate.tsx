import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { VariableHelper } from '../components/sms/VariableHelper';
import { extractVariables } from '../lib/smsVariables';

const CATEGORIES = [
  { value: 'helg', label: 'Helg' },
  { value: 'påminnelse', label: 'Påminnelse' },
  { value: 'info', label: 'Info' },
  { value: 'event', label: 'Event' },
  { value: 'övrigt', label: 'Övrigt' }
];

export default function CreateTemplate() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('övrigt');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get admin session
  const getAdminMemberId = (): string | null => {
    const sessionStr = localStorage.getItem('khbf_admin_session');
    if (!sessionStr) return null;
    try {
      const session = JSON.parse(sessionStr);
      return session.memberId || null;
    } catch {
      return null;
    }
  };

  const handleInsertVariable = (variable: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    // Insert variable at cursor position
    const newText = text.substring(0, start) + variable + text.substring(end);
    setTemplate(newText);

    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const handleSave = async () => {
    if (!name.trim() || !template.trim()) {
      alert('Namn och mall är obligatoriska');
      return;
    }

    const adminMemberId = getAdminMemberId();
    if (!adminMemberId) {
      alert('Du måste vara inloggad för att skapa mallar');
      return;
    }

    setSaving(true);

    try {
      // Extract variables used in template
      const variablesUsed = extractVariables(template);

      const { data, error } = await supabase
        .from('message_templates')
        .insert({
          name: name.trim(),
          template: template.trim(),
          description: description.trim() || null,
          variables_used: variablesUsed,
          category,
          created_by_type: 'admin',
          created_by_admin_id: adminMemberId,
          ai_generated: false,
          usage_count: 0
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Template created:', data);
      navigate('/messages/templates', { replace: true });
    } catch (error: any) {
      console.error('Failed to create template:', error);
      alert(`Kunde inte skapa mall: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Count detected variables
  const detectedVariables = extractVariables(template);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate('/messages/templates')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Tillbaka</span>
          </button>
          <h1 className="text-xl font-semibold">Skapa mall</h1>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim() || !template.trim()}
            size="sm"
            className="flex items-center gap-1"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Sparar...' : 'Spara'}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="px-4 py-6 space-y-4 max-w-2xl mx-auto">
        {/* Basic Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Grundläggande information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mallnamn *
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="T.ex. Helghälsning, Påminnelse besök"
                maxLength={100}
              />
              <p className="text-xs text-gray-500 mt-1">
                Ett kort, beskrivande namn för mallen
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beskrivning
              </label>
              <Input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="När ska denna mall användas?"
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1">
                Frivillig beskrivning av mallens syfte
              </p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategori *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Template Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Malltext *</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <textarea
                ref={textareaRef}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder="Skriv din mall här... Använd variabler som {{förnamn}} för att personalisera"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] font-mono text-sm"
                maxLength={500}
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-500">
                  {template.length}/500 tecken
                </p>
                {detectedVariables.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-blue-600">
                    <Sparkles className="h-3 w-3" />
                    <span>{detectedVariables.length} variabler hittade</span>
                  </div>
                )}
              </div>
            </div>

            {/* Detected variables preview */}
            {detectedVariables.length > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs font-medium text-blue-900 mb-2">
                  Variabler i mallen:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {detectedVariables.map(variable => (
                    <code
                      key={variable}
                      className="px-2 py-0.5 bg-white text-blue-700 rounded text-xs font-mono border border-blue-300"
                    >
                      {variable}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {/* Variable Helper */}
            <VariableHelper onInsertVariable={handleInsertVariable} />
          </CardContent>
        </Card>

        {/* Preview Card */}
        {template && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Förhandsvisning</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {template}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Variabler kommer att ersättas med mottagarens riktiga data när meddelandet skickas
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
