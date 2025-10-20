import { Card, CardContent } from '../ui/card';
import type { DynamicGroupRule, RuleLogic } from '../../types/groups';

interface RuleBuilderProps {
  rules: DynamicGroupRule[];
  rulesLogic: RuleLogic;
  onRulesChange: (rules: DynamicGroupRule[]) => void;
  onLogicChange: (logic: RuleLogic) => void;
}

export function RuleBuilder({ rules, onRulesChange }: RuleBuilderProps) {

  // Get current selections from rules
  const activityStatusRule = rules.find(r => r.type === 'activity_status');
  const categoryRule = rules.find(r => r.type === 'category');

  const selectedActivityStatuses = activityStatusRule
    ? (Array.isArray(activityStatusRule.value) ? activityStatusRule.value.map(String) : [String(activityStatusRule.value)])
    : [];

  const selectedCategories = categoryRule
    ? (Array.isArray(categoryRule.value) ? categoryRule.value.map(String) : [String(categoryRule.value)])
    : [];

  function toggleActivityStatus(value: string) {
    const current = [...selectedActivityStatuses];
    const index = current.indexOf(value);

    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(value);
    }

    updateActivityStatusRule(current);
  }

  function toggleCategory(value: string) {
    const current = [...selectedCategories];
    const index = current.indexOf(value);

    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(value);
    }

    updateCategoryRule(current);
  }

  function updateActivityStatusRule(values: string[]) {
    const otherRules = rules.filter(r => r.type !== 'activity_status');

    if (values.length > 0 && values.length < 2) {
      // Only add rule if one is selected (not both, which means "all")
      onRulesChange([
        ...otherRules,
        { type: 'activity_status', value: values }
      ]);
    } else {
      // Both or none selected = no filter
      onRulesChange(otherRules);
    }
  }

  function updateCategoryRule(values: string[]) {
    const otherRules = rules.filter(r => r.type !== 'category');

    if (values.length > 0 && values.length < 4) {
      // Only add rule if some (not all) are selected
      onRulesChange([
        ...otherRules,
        { type: 'category', value: values }
      ]);
    } else {
      // All or none selected = no filter
      onRulesChange(otherRules);
    }
  }

  const activityOptions = [
    { value: 'active', label: 'Aktiv', description: 'Besökt senaste 3 månader' },
    { value: 'inactive', label: 'Inaktiv', description: 'INTE besökt senaste 3 månader' },
  ];

  const categoryOptions = [
    { value: 'MEDLEM', label: 'Medlem', count: null as number | null },
    { value: 'MEDBADARE', label: 'Medbadare', count: null as number | null },
    { value: 'KÖANDE', label: 'Köande', count: null as number | null },
    { value: 'INAKTIV', label: 'Inaktiv', count: null as number | null },
  ];

  return (
    <div className="space-y-4">
      {/* Activity Status Section */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Aktivitetsstatus
              </h3>
              <p className="text-xs text-gray-500">
                Välj båda eller ingen för att inkludera alla
              </p>
            </div>

            <div className="space-y-2">
              {activityOptions.map(option => (
                <label
                  key={option.value}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedActivityStatuses.includes(option.value)}
                    onChange={() => toggleActivityStatus(option.value)}
                    className="mt-0.5 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Section */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Kategori
              </h3>
              <p className="text-xs text-gray-500">
                Välj alla eller ingen för att inkludera alla
              </p>
            </div>

            <div className="space-y-2">
              {categoryOptions.map(option => (
                <label
                  key={option.value}
                  className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(option.value)}
                      onChange={() => toggleCategory(option.value)}
                      className="mt-0.5 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <div className="text-sm font-medium text-gray-900">
                      {option.label}
                    </div>
                  </div>
                  {option.count !== null && (
                    <div className="text-sm font-semibold text-purple-600">
                      {option.count}
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {(selectedActivityStatuses.length > 0 || selectedCategories.length > 0) && (
        <div className="text-xs text-gray-500 p-3 bg-purple-50 rounded-lg border border-purple-100">
          <span className="font-medium text-purple-700">Aktiva filter: </span>
          {selectedActivityStatuses.length === 0 && 'Alla aktivitetsstatuser, '}
          {selectedActivityStatuses.length === 1 && `${activityOptions.find(o => o.value === selectedActivityStatuses[0])?.label}, `}
          {selectedActivityStatuses.length === 2 && 'Alla aktivitetsstatuser, '}

          {selectedCategories.length === 0 && 'alla kategorier'}
          {selectedCategories.length > 0 && selectedCategories.length < 4 &&
            selectedCategories.map(cat =>
              categoryOptions.find(o => o.value === cat)?.label
            ).join(', ')
          }
          {selectedCategories.length === 4 && 'alla kategorier'}
        </div>
      )}
    </div>
  );
}
