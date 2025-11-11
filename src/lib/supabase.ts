import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Member {
  id: string;
  fortnox_customer_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string | null;
  phone_type: string | null;
  primary_phone: string;
  personal_identity_number: string;
  status: string;
  address: string;
  postal_code: string;
  city: string;
  aptus_user_id: string | null;
  parakey_user_id: string | null;
  phone_count: number;
  visits_last_week: number;
  visits_last_month: number;
  visits_last_3_months: number;
  visits_total: number;
  last_visit_at: string;
  first_visit_at: string;
  created_at: string;
  updated_at: string;
  // Payment tracking
  first_queue_fee_date: string | null;
  last_queue_fee_date: string | null;
  last_annual_fee_date: string | null;
  last_entrance_fee_date: string | null;
  fortnox_customer_since: string | null;
  // Gamification
  badges?: Array<{ user_id: string; achievement_type: string; earned_at: string; is_dynamic: boolean }>;
  related_members?: string[];
}
