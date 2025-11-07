import { Card, CardContent } from '../ui/card';
import type { DynamicGroupRule, RuleLogic, DoorAccessPeriod } from '../../types/groups';

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
  const doorAccessRule = rules.find(r => r.type === 'door_access');
  const accessMethodRule = rules.find(r => r.type === 'access_method');

  const selectedActivityStatuses = activityStatusRule
    ? (Array.isArray(activityStatusRule.value) ? activityStatusRule.value.map(String) : [String(activityStatusRule.value)])
    : [];

  const selectedCategories = categoryRule
    ? (Array.isArray(categoryRule.value) ? categoryRule.value.map(String) : [String(categoryRule.value)])
    : [];

  const selectedDoorAccess = doorAccessRule
    ? (Array.isArray(doorAccessRule.value) ? doorAccessRule.value.map(String) : [String(doorAccessRule.value)])
    : [];

  const selectedAccessMethods = accessMethodRule
    ? (Array.isArray(accessMethodRule.value) ? accessMethodRule.value.map(String) : [String(accessMethodRule.value)])
    : [];

  const selectedDoorAccessPeriod: DoorAccessPeriod = doorAccessRule?.period || '3months';

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

  function toggleDoorAccess(value: string) {
    const current = [...selectedDoorAccess];
    const index = current.indexOf(value);

    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(value);
    }

    updateDoorAccessRule(current);
  }

  function toggleAccessMethod(value: string) {
    const current = [...selectedAccessMethods];
    const index = current.indexOf(value);

    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(value);
    }

    updateAccessMethodRule(current);
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

  function updateDoorAccessRule(values: string[], period?: DoorAccessPeriod) {
    const otherRules = rules.filter(r => r.type !== 'door_access');
    const currentPeriod = period || selectedDoorAccessPeriod;

    if (values.length > 0 && values.length < 2) {
      // Only add rule if one is selected (not both, which means "all")
      onRulesChange([
        ...otherRules,
        { type: 'door_access', value: values, period: currentPeriod }
      ]);
    } else {
      // Both or none selected = no filter
      onRulesChange(otherRules);
    }
  }

  function updateDoorAccessPeriod(period: DoorAccessPeriod) {
    const otherRules = rules.filter(r => r.type !== 'door_access');

    // If we have selected doors, update the rule with new period
    if (selectedDoorAccess.length > 0 && selectedDoorAccess.length < 2) {
      onRulesChange([
        ...otherRules,
        { type: 'door_access', value: selectedDoorAccess, period }
      ]);
    }
  }

  function updateAccessMethodRule(values: string[]) {
    const otherRules = rules.filter(r => r.type !== 'access_method');

    if (values.length > 0 && values.length < 2) {
      // Only add rule if one is selected (not both, which means "all")
      onRulesChange([
        ...otherRules,
        { type: 'access_method', value: values }
      ]);
    } else {
      // Both or none selected = no filter
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

  const doorAccessOptions = [
    { value: 'GENTS', label: 'Herrsidan' },
    { value: 'LADIES', label: 'Damsidan' },
  ];

  const accessMethodOptions = [
    { value: 'parakey', label: 'Parakey', description: 'Mobilapp-användare' },
    { value: 'rfid', label: 'RFID-tagg', description: 'Endast tagg (ej mobilapp)' },
  ];

  const periodOptions = [
    { value: 'week' as DoorAccessPeriod, label: 'Senaste veckan' },
    { value: 'month' as DoorAccessPeriod, label: 'Senaste månaden' },
    { value: '3months' as DoorAccessPeriod, label: 'Senaste kvartalet (3 mån)' },
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

      {/* Door Access Section */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Har använt
              </h3>
              <p className="text-xs text-gray-500">
                Välj båda eller ingen för att inkludera alla
              </p>
            </div>

            <div className="space-y-2">
              {doorAccessOptions.map(option => (
                <label
                  key={option.value}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedDoorAccess.includes(option.value)}
                    onChange={() => toggleDoorAccess(option.value)}
                    className="mt-0.5 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {option.label}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Period selector - only show if a door is selected */}
            {selectedDoorAccess.length > 0 && selectedDoorAccess.length < 2 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <h4 className="text-xs font-semibold text-gray-600 mb-2">Tidsperiod</h4>
                <div className="space-y-1.5">
                  {periodOptions.map(option => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <input
                        type="radio"
                        name="door_access_period"
                        checked={selectedDoorAccessPeriod === option.value}
                        onChange={() => updateDoorAccessPeriod(option.value)}
                        className="h-4 w-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Access Method Section */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Accessmetod
              </h3>
              <p className="text-xs text-gray-500">
                Välj båda eller ingen för att inkludera alla
              </p>
            </div>

            <div className="space-y-2">
              {accessMethodOptions.map(option => (
                <label
                  key={option.value}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedAccessMethods.includes(option.value)}
                    onChange={() => toggleAccessMethod(option.value)}
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
      {(selectedActivityStatuses.length > 0 || selectedCategories.length > 0 || selectedDoorAccess.length > 0 || selectedAccessMethods.length > 0) && (
        <div className="text-xs text-gray-500 p-3 bg-purple-50 rounded-lg border border-purple-100">
          <span className="font-medium text-purple-700">Aktiva filter: </span>
          {selectedActivityStatuses.length === 0 && 'Alla aktivitetsstatuser, '}
          {selectedActivityStatuses.length === 1 && `${activityOptions.find(o => o.value === selectedActivityStatuses[0])?.label}, `}
          {selectedActivityStatuses.length === 2 && 'Alla aktivitetsstatuser, '}

          {selectedDoorAccess.length === 0 && 'alla dörrar, '}
          {selectedDoorAccess.length === 1 && `${doorAccessOptions.find(o => o.value === selectedDoorAccess[0])?.label} (${periodOptions.find(p => p.value === selectedDoorAccessPeriod)?.label.toLowerCase()}), `}
          {selectedDoorAccess.length === 2 && 'alla dörrar, '}

          {selectedAccessMethods.length === 0 && 'alla accessmetoder, '}
          {selectedAccessMethods.length === 1 && `${accessMethodOptions.find(o => o.value === selectedAccessMethods[0])?.label}, `}
          {selectedAccessMethods.length === 2 && 'alla accessmetoder, '}

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
