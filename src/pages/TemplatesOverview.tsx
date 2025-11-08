import { useEffect, useState } from 'react';
import { Search, Sparkles, User, Clock, MessageSquare, Plus, Pencil, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

interface MessageTemplate {
  id: string;
  name: string;
  template: string;
  description: string | null;
  variables_used: string[] | null;
  category: string | null;
  created_by_type: 'ai' | 'admin';
  ai_generated: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
}

export default function TemplatesOverview() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    template: '',
    description: '',
    category: ''
  });

  useEffect(() => {
    loadTemplates();

    // Subscribe to template changes
    const subscription = supabase
      .channel('message_templates_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'message_templates' },
        () => {
          loadTemplates();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadTemplates() {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .is('deleted_at', null)
        .order('usage_count', { ascending: false });

      if (error) throw error;

      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setFormData({
      name: '',
      template: '',
      description: '',
      category: ''
    });
    setShowCreateDialog(true);
  }

  function openEditDialog(template: MessageTemplate) {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      template: template.template,
      description: template.description || '',
      category: template.category || ''
    });
    setShowEditDialog(true);
  }

  function closeDialogs() {
    setShowEditDialog(false);
    setShowCreateDialog(false);
    setEditingTemplate(null);
  }

  async function handleCreate() {
    try {
      const { error } = await supabase
        .from('message_templates')
        .insert({
          name: formData.name,
          template: formData.template,
          description: formData.description || null,
          category: formData.category || null,
          created_by_type: 'admin',
          ai_generated: false,
          usage_count: 0
        });

      if (error) throw error;

      closeDialogs();
      loadTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      alert('Kunde inte skapa mall');
    }
  }

  async function handleUpdate() {
    if (!editingTemplate) return;

    try {
      const { error } = await supabase
        .from('message_templates')
        .update({
          name: formData.name,
          template: formData.template,
          description: formData.description || null,
          category: formData.category || null
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;

      closeDialogs();
      loadTemplates();
    } catch (error) {
      console.error('Error updating template:', error);
      alert('Kunde inte uppdatera mall');
    }
  }

  async function handleDelete(templateId: string, templateName: string) {
    if (!confirm(`Är du säker på att du vill ta bort "${templateName}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('message_templates')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', templateId);

      if (error) throw error;

      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Kunde inte ta bort mall');
    }
  }

  const filteredTemplates = templates.filter(template => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.template.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = !categoryFilter || template.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = Array.from(new Set(templates.map(t => t.category).filter(Boolean))) as string[];

  const getCategoryColor = (category: string | null) => {
    const colors: Record<string, string> = {
      'helg': 'bg-purple-100 text-purple-700 border-purple-200',
      'påminnelse': 'bg-blue-100 text-blue-700 border-blue-200',
      'info': 'bg-gray-100 text-gray-700 border-gray-200',
      'event': 'bg-green-100 text-green-700 border-green-200',
      'övrigt': 'bg-orange-100 text-orange-700 border-orange-200'
    };
    return category ? colors[category] || colors['övrigt'] : colors['övrigt'];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Laddar mallar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-xl font-semibold">Mallar</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {templates.length} mallar totalt
            </p>
          </div>
          <button
            onClick={openCreateDialog}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Ny mall
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Sök mallar..."
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

        {/* Category filters */}
        {categories.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setCategoryFilter(null)}
                className={`
                  px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap
                  transition-colors
                  ${!categoryFilter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                Alla
              </button>
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap
                    transition-colors border
                    ${categoryFilter === category
                      ? getCategoryColor(category)
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }
                  `}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <MessageSquare className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Inga mallar än</h2>
          <p className="text-sm text-gray-600 text-center mb-6 max-w-xs">
            Mallar skapas automatiskt när du skickar gruppmeddelanden via AI
          </p>
        </div>
      )}

      {/* Templates list */}
      {templates.length > 0 && (
        <div className="pb-6">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-sm text-gray-600">
                Inga mallar matchar "{searchQuery}"
              </p>
            </div>
          ) : (
            <div className="px-4 pt-4 space-y-3">
              {filteredTemplates.map(template => (
                <Card key={template.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm truncate">
                            {template.name}
                          </h3>
                          {template.ai_generated ? (
                            <Sparkles className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />
                          ) : (
                            <User className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                          )}
                        </div>
                        {template.description && (
                          <p className="text-xs text-gray-500 line-clamp-1">
                            {template.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {template.category && (
                          <Badge
                            variant="outline"
                            className={`text-xs flex-shrink-0 ${getCategoryColor(template.category)}`}
                          >
                            {template.category}
                          </Badge>
                        )}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditDialog(template)}
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                            title="Redigera"
                          >
                            <Pencil className="h-4 w-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(template.id, template.name)}
                            className="p-1.5 hover:bg-red-50 rounded transition-colors"
                            title="Ta bort"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Template preview */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {template.template}
                      </p>
                    </div>

                    {/* Variables */}
                    {template.variables_used && template.variables_used.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-500 mb-1.5">
                          Variabler:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {template.variables_used.map(variable => (
                            <code
                              key={variable}
                              className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono border border-blue-200"
                            >
                              {`{{${variable}}}`}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer stats */}
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>{template.usage_count} användningar</span>
                        </div>
                        {template.last_used_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {formatDistanceToNow(new Date(template.last_used_at), {
                                addSuffix: true,
                                locale: sv
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {template.ai_generated ? 'AI-genererad' : 'Manuell'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      {(showCreateDialog || showEditDialog) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Dialog Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">
                {showCreateDialog ? 'Skapa ny mall' : 'Redigera mall'}
              </h2>
              <button
                onClick={closeDialogs}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Dialog Content */}
            <div className="p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Namn <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="T.ex. Helghälsning"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Välj kategori</option>
                  <option value="helg">Helg</option>
                  <option value="påminnelse">Påminnelse</option>
                  <option value="info">Info</option>
                  <option value="event">Event</option>
                  <option value="övrigt">Övrigt</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beskrivning
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Kort beskrivning av mallen"
                />
              </div>

              {/* Template */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Malltext <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.template}
                  onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="Använd {{variabel}} för variabler&#10;T.ex: Hej {{first_name}}!"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Använd <code className="px-1 bg-gray-100 rounded">{'{{variabel}}'}</code> för dynamiska värden
                </p>
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={closeDialogs}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={showCreateDialog ? handleCreate : handleUpdate}
                disabled={!formData.name || !formData.template}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {showCreateDialog ? 'Skapa' : 'Spara'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
