// SMS Groups Types
// Types for both static and dynamic message groups

export type GroupType = 'static' | 'dynamic';
export type RuleLogic = 'AND' | 'OR';

// Rule types for dynamic groups
export type RuleType =
  | 'activity_status'
  | 'category'
  | 'visit_activity'
  | 'activity_level'
  | 'access_method'
  | 'last_visit'
  | 'visit_count';

export type ActivityStatusValue = 'active' | 'inactive';

export type MemberCategoryValue =
  | 'MEDLEM'
  | 'MEDBADARE'
  | 'KÖANDE'
  | 'INAKTIV';

export type VisitActivityValue =
  | 'last_week'
  | 'last_month'
  | 'last_3_months'
  | 'no_visits_3_months';

export type AccessMethodValue = 'parakey' | 'rfid';

// Individual rule definition
export interface DynamicGroupRule {
  id?: string; // For UI management
  type: RuleType;
  operator?: string;
  value: string | number | string[]; // Support arrays for multi-select
  label?: string; // Human-readable display
}

// Complete rules structure
export interface DynamicGroupRules {
  logic: RuleLogic;
  rules: DynamicGroupRule[];
}

// Database group record
export interface Group {
  id: string;
  name: string;
  description?: string | null;
  type: GroupType;

  // Dynamic group rules
  rules?: DynamicGroupRules | null;
  rules_logic?: RuleLogic;

  // Cached member count
  member_count: number;
  last_count_update?: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// Group member (for static groups)
export interface GroupMember {
  id: string;
  group_id: string;
  member_id: string;
  added_at: string;

  // Joined member data
  member?: {
    id: string;
    first_name: string;
    last_name: string;
    fortnox_customer_number: string;
    phone_number?: string;
    last_visit_at?: string | null;
    visits_last_month?: number;
  };
}

// Member info from resolve functions
export interface GroupMemberInfo {
  member_id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  fortnox_customer_number: string;
  last_visit_at?: string | null;
  visits_last_month?: number;
}

// Form data for creating groups
export interface CreateStaticGroupData {
  name: string;
  description?: string;
  member_ids: string[];
}

export interface CreateDynamicGroupData {
  name: string;
  description?: string;
  rules: DynamicGroupRules;
}

// UI state for group creation
export interface GroupFormState {
  name: string;
  description: string;
  type: GroupType | null;

  // Static group state
  selectedMembers: GroupMemberInfo[];

  // Dynamic group state
  rules: DynamicGroupRule[];
  rulesLogic: RuleLogic;
  memberPreviewCount: number;
}

// Group statistics
export interface GroupStats {
  total_groups: number;
  static_groups: number;
  dynamic_groups: number;
  total_members: number;
  messages_sent: number;
}
