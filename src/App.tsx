import { useEffect, useState, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { supabase, type Member } from './lib/supabase';
import { DashboardLayout } from './components/DashboardLayout';
import { AdminLogin } from './components/AdminLogin';
import { StatsCard } from './components/StatsCard';
import { Users, UserCheck, Activity, TrendingUp } from 'lucide-react';
import { usePageTitle } from './hooks/usePageTitle';
import { SidebarProvider } from './contexts/SidebarContext';

// Lazy load heavy components
const MemberList = lazy(() => import('./MemberList'));
const MemberDetail = lazy(() => import('./MemberDetail'));
const MemberRedirect = lazy(() => import('./components/MemberRedirect').then(m => ({ default: m.MemberRedirect })));
const ParakeyMapping = lazy(() => import('./ParakeyMapping'));
const AptusOverview = lazy(() => import('./pages/AptusOverview'));
const SMSInbox = lazy(() => import('./SMSInbox').then(module => ({ default: module.SMSInbox })));
const SMSThread = lazy(() => import('./SMSThread').then(module => ({ default: module.SMSThread })));
const GroupDetail = lazy(() => import('./components/GroupDetail').then(module => ({ default: module.GroupDetail })));
const NewMessage = lazy(() => import('./components/NewMessage').then(module => ({ default: module.NewMessage })));
const GroupsOverview = lazy(() => import('./pages/GroupsOverview'));
const CreateGroup = lazy(() => import('./pages/CreateGroup'));
const EditGroup = lazy(() => import('./pages/EditGroup'));
const GroupDetailView = lazy(() => import('./components/groups/GroupDetailView').then(module => ({ default: module.GroupDetailView })));
const TemplatesOverview = lazy(() => import('./pages/TemplatesOverview'));
const SMSLogs = lazy(() => import('./pages/SMSLogs'));
const AIChat = lazy(() => import('./pages/AIChat'));
const CleaningOverview = lazy(() => import('./pages/CleaningOverview').then(module => ({ default: module.CleaningOverview })));
const PrizesOverview = lazy(() => import('./pages/PrizesOverview').then(module => ({ default: module.PrizesOverview })));

export type Period = 'week' | 'month' | '3months';

const SESSION_STORAGE_KEY = 'khbf_admin_session';

// Simple in-memory cache with 5-minute TTL
let membersCache: {
  data: Member[];
  timestamp: number;
} | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function App() {
  const location = useLocation();
  const pageTitle = usePageTitle();

  // Auth state
  const [session, setSession] = useState<{
    memberId: string;
    memberName: string;
    phoneNumber: string;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Member data state
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [search, setSearch] = useState('');

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession);
        setSession(parsedSession);
      } catch (error) {
        console.error('Failed to parse saved session:', error);
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    // Only fetch members when on members list page or member detail page
    const isMembersPage = location.pathname === '/members';
    const isMemberDetailPage = location.pathname.startsWith('/members/');
    const needsMemberData = isMembersPage || isMemberDetailPage;

    if (session) {
      if (needsMemberData) {
        fetchMembers();

        // Auto-refresh every 30 seconds only on members list page
        let intervalId: number | null = null;
        if (isMembersPage) {
          intervalId = setInterval(() => {
            fetchMembers(false); // Don't show loading spinner for auto-refresh
          }, 30000);
        }

        return () => {
          if (intervalId) clearInterval(intervalId);
        };
      } else {
        // On pages that don't need member data, set loading to false immediately
        setLoading(false);
      }
    }
  }, [session, location.pathname]);

  function handleLogin(memberId: string, memberName: string, phoneNumber: string) {
    const newSession = { memberId, memberName, phoneNumber };
    setSession(newSession);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
  }

  function handleLogout() {
    setSession(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  // Helper: Fetch all members with pagination
  async function fetchAllMembers() {
    let allMembers: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Error fetching members:', error);
        break;
      }

      if (!data || data.length === 0) break;
      allMembers = allMembers.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // Sort numerically by fortnox_customer_number (same as AI system)
    // This ensures queue positions match between admin and AI
    allMembers.sort((a, b) => {
      const aNum = parseInt(a.fortnox_customer_number) || 999999;
      const bNum = parseInt(b.fortnox_customer_number) || 999999;
      return aNum - bNum;
    });

    return allMembers;
  }

  // Helper: Fetch all visits with pagination
  async function fetchAllVisits(thirtyDaysAgo: Date) {
    // Fetch visits directly by member_id (more reliable than userid filtering)
    // Use visit ID to deduplicate and ensure accurate counts
    const [recentResult, allResult] = await Promise.all([
      // Recent visits (for 30-day stats) - with ID for deduplication
      (async () => {
        const visitIds = new Set<string>();
        const visits: any[] = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
          const { data } = await supabase
            .from('visits')
            .select('id, member_id')
            .not('member_id', 'is', null)
            .gte('eventtime', thirtyDaysAgo.toISOString())
            .order('id')
            .range(from, from + pageSize - 1);

          if (!data || data.length === 0) break;

          // Deduplicate by visit ID to prevent double-counting
          for (const visit of data) {
            if (!visitIds.has(visit.id)) {
              visitIds.add(visit.id);
              visits.push(visit);
            }
          }

          if (data.length < pageSize) break;
          from += pageSize;
        }
        return visits;
      })(),

      // All visits (for total count and last visit) - with ID for deduplication
      (async () => {
        const visitIds = new Set<string>();
        const visits: any[] = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
          const { data } = await supabase
            .from('visits')
            .select('id, member_id, eventtime')
            .not('member_id', 'is', null)
            .order('eventtime', { ascending: false })
            .range(from, from + pageSize - 1);

          if (!data || data.length === 0) break;

          // Deduplicate by visit ID to prevent double-counting
          for (const visit of data) {
            if (!visitIds.has(visit.id)) {
              visitIds.add(visit.id);
              visits.push(visit);
            }
          }

          if (data.length < pageSize) break;
          from += pageSize;
        }
        return visits;
      })()
    ]);

    return { recent: recentResult, all: allResult };
  }

  async function fetchMembers(showLoading = true) {
    // Check cache first
    if (membersCache && (Date.now() - membersCache.timestamp) < CACHE_TTL) {
      console.log('✅ Using cached members data');
      setMembers(membersCache.data);
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);

    const startTime = performance.now();

    try {
      // Calculate 30 days ago once
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Run all queries in parallel for maximum performance
      const [membersResult, visitsResult, phoneResult, relationsResult, badgesResult] = await Promise.all([
        // 1. Fetch all members (paginated)
        fetchAllMembers(),

        // 2. Fetch visits from last 30 days (paginated)
        fetchAllVisits(thirtyDaysAgo),

        // 3. Fetch phone numbers
        supabase
          .from('phone_mappings')
          .select('member_id, phone_number, phone_type, is_primary')
          .eq('is_primary', true),

        // 4. Fetch member relations
        supabase
          .from('member_relations')
          .select('medbadare_member_id, primary_member_id'),

        // 5. Fetch active badges
        supabase
          .from('member_achievements')
          .select('user_id, achievement_type, achievement_data, is_active')
          .eq('is_active', true)
      ]);

      const membersData = membersResult;
      console.log(`✅ Loaded ${membersData.length} members`);

      // Process visits
      const { recent: recentVisits, all: allVisits } = visitsResult;

      // Count visits per member for last 30 days (using member_id, not userid)
      const visitCounts = new Map<string, number>();
      recentVisits.forEach(v => {
        if (v.member_id) {
          visitCounts.set(v.member_id, (visitCounts.get(v.member_id) || 0) + 1);
        }
      });

      // Count total visits and find last visit (using member_id, not userid)
      const totalVisitsMap = new Map<string, number>();
      const lastVisitMap = new Map<string, string>();
      allVisits.forEach(v => {
        if (v.member_id) {
          totalVisitsMap.set(v.member_id, (totalVisitsMap.get(v.member_id) || 0) + 1);
          if (!lastVisitMap.has(v.member_id)) {
            lastVisitMap.set(v.member_id, v.eventtime);
          }
        }
      });

      console.log(`✅ Loaded ${recentVisits.length} recent visits, ${allVisits.length} total visits`);

      // Build phone map
      const phoneMap = new Map<string, { phone: string; type: string }>();
      phoneResult.data?.forEach(p => {
        phoneMap.set(p.member_id, { phone: p.phone_number, type: p.phone_type });
      });

      // Build relations map
      const relationsMap = new Map<string, string[]>();
      relationsResult.data?.forEach(r => {
        const existing = relationsMap.get(r.medbadare_member_id) || [];
        existing.push(r.primary_member_id);
        relationsMap.set(r.medbadare_member_id, existing);
      });

      // Build badges map
      const badgesMap = new Map<string, any[]>();
      badgesResult.data?.forEach(badge => {
        const existing = badgesMap.get(badge.user_id) || [];
        existing.push(badge);
        badgesMap.set(badge.user_id, existing);
      });

      console.log(`✅ Loaded ${badgesResult.data?.length || 0} badges for ${badgesMap.size} members`);

      // Merge member data with visit counts, phone numbers, and badges
      const membersWithVisits = membersData
        .filter(m => !m.is_system_account)
        .map(m => {
          const phoneInfo = phoneMap.get(m.id);

          // Get visits directly by member_id (more reliable than aptus/parakey IDs)
          const totalVisits = totalVisitsMap.get(m.id) || 0;
          const lastVisit = lastVisitMap.get(m.id) || null;
          const visitsLastMonth = visitCounts.get(m.id) || 0;

          return {
            ...m,
            full_name: `${m.first_name} ${m.last_name || ''}`,
            phone: phoneInfo?.phone || null,
            phone_type: phoneInfo?.type || null,
            visits_last_month: visitsLastMonth,
            visits_total: totalVisits,
            last_visit_at: lastVisit,
            related_members: relationsMap.get(m.id) || [],
            badges: badgesMap.get(m.id) || [],
          };
        });

      const endTime = performance.now();
      const loadTime = ((endTime - startTime) / 1000).toFixed(2);
      console.log(`✅ Fetched ${membersWithVisits.length} members in ${loadTime}s`);

      // Cache the result
      membersCache = {
        data: membersWithVisits,
        timestamp: Date.now()
      };

      setMembers(membersWithVisits);
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  // Show loading state while checking for saved session
  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p>Laddar...</p>
      </div>
    );
  }

  // Not logged in - show login screen
  if (!session) {
    return <AdminLogin onLoginSuccess={handleLogin} />;
  }

  // Logged in - show admin app
  if (loading) {
    return (
      <SidebarProvider>
        <DashboardLayout userName={session.memberName} onLogout={handleLogout} title={pageTitle}>
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Laddar medlemmar...</p>
          </div>
        </DashboardLayout>
      </SidebarProvider>
    );
  }

  // Calculate stats
  const totalMembers = members.length;
  const activeMembers = members.filter(m => m.aptus_user_id || m.parakey_user_id).length;
  const totalVisitsThisMonth = members.reduce((sum, m) => sum + (m.visits_last_month || 0), 0);

  // Calculate average visits per week for active members (visited in last 3 months)
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const activeMembersWithVisits = members.filter(m =>
    m.last_visit_at && new Date(m.last_visit_at) >= threeMonthsAgo
  );
  const totalVisitsLast3Months = activeMembersWithVisits.reduce((sum, m) => sum + (m.visits_last_3_months || 0), 0);
  const avgVisitsPerMember = activeMembersWithVisits.length > 0
    ? (totalVisitsLast3Months / activeMembersWithVisits.length / 13).toFixed(1)
    : 0;

  return (
    <SidebarProvider>
      <DashboardLayout userName={session.memberName} onLogout={handleLogout} title={pageTitle}>
        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        }>
          <Routes>
          <Route path="/" element={<Navigate to="/ai-chat" replace />} />
          <Route
            path="/members"
            element={
              <>
                {/* Stats Cards - horizontal scroll on mobile, grid on desktop */}
                <div className="flex gap-4 overflow-x-auto pb-2 mb-6 lg:grid lg:grid-cols-4 lg:overflow-visible">
                  <StatsCard
                    title="Totalt Medlemmar"
                    value={totalMembers}
                    description="Aktiva medlemmar i systemet"
                    icon={Users}
                  />
                  <StatsCard
                    title="Med Access"
                    value={activeMembers}
                    description="Medlemmar med Aptus eller Parakey"
                    icon={UserCheck}
                  />
                  <StatsCard
                    title="Besök (30 dagar)"
                    value={totalVisitsThisMonth}
                    description="Totalt antal besök senaste månaden"
                    icon={Activity}
                  />
                  <StatsCard
                    title="Genomsnittligt Besök"
                    value={avgVisitsPerMember}
                    description="Per aktiv medlem (vecka)"
                    icon={TrendingUp}
                  />
                </div>

                <MemberList
                  members={members}
                  period={period}
                  setPeriod={setPeriod}
                  search={search}
                  setSearch={setSearch}
                />
              </>
            }
          />
          <Route
            path="/members/prizes"
            element={<PrizesOverview />}
          />
          <Route
            path="/members/:id"
            element={<MemberDetail />}
          />
          {/* Redirect old /medlem/:id URLs to /members/:id for backwards compatibility */}
          <Route
            path="/medlem/:id"
            element={<MemberRedirect />}
          />
          <Route
            path="/parakey-mapping"
            element={<ParakeyMapping />}
          />
          <Route
            path="/aptus"
            element={<AptusOverview />}
          />
          <Route
            path="/cleaning"
            element={<CleaningOverview />}
          />
          <Route
            path="/messages"
            element={<SMSInbox adminMemberId={session.memberId} adminMemberName={session.memberName} />}
          />
          <Route
            path="/messages/new"
            element={<NewMessage />}
          />
          <Route
            path="/messages/groups"
            element={<GroupsOverview />}
          />
          <Route
            path="/messages/groups/new"
            element={<CreateGroup />}
          />
          <Route
            path="/messages/templates"
            element={<TemplatesOverview />}
          />
          <Route
            path="/messages/logs"
            element={<SMSLogs />}
          />
          <Route
            path="/messages/groups/:id/edit"
            element={<EditGroup />}
          />
          <Route
            path="/messages/groups/:id"
            element={<GroupDetailView />}
          />
          <Route
            path="/messages/group/:groupId"
            element={<GroupDetail />}
          />
          <Route
            path="/messages/:threadId"
            element={<SMSThread />}
          />
          <Route
            path="/ai-chat"
            element={<AIChat />}
          />
          </Routes>
        </Suspense>
      </DashboardLayout>
    </SidebarProvider>
  );
}

export default App;
