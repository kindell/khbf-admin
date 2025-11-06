import { useEffect, useState, lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
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
const ParakeyMapping = lazy(() => import('./ParakeyMapping'));
const SMSInbox = lazy(() => import('./SMSInbox').then(module => ({ default: module.SMSInbox })));
const SMSThread = lazy(() => import('./SMSThread').then(module => ({ default: module.SMSThread })));
const GroupDetail = lazy(() => import('./components/GroupDetail').then(module => ({ default: module.GroupDetail })));
const NewMessage = lazy(() => import('./components/NewMessage').then(module => ({ default: module.NewMessage })));
const GroupsOverview = lazy(() => import('./pages/GroupsOverview'));
const CreateGroup = lazy(() => import('./pages/CreateGroup'));
const EditGroup = lazy(() => import('./pages/EditGroup'));
const GroupDetailView = lazy(() => import('./components/groups/GroupDetailView').then(module => ({ default: module.GroupDetailView })));
const SMSLogs = lazy(() => import('./pages/SMSLogs'));

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
    // Only fetch members when on home page or member detail page
    const isHomePage = location.pathname === '/';
    const isMemberDetailPage = location.pathname.startsWith('/medlem/');
    const needsMemberData = isHomePage || isMemberDetailPage;

    if (session) {
      if (needsMemberData) {
        fetchMembers();

        // Auto-refresh every 30 seconds only on home page
        let intervalId: NodeJS.Timeout | null = null;
        if (isHomePage) {
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
    const recentVisits: any[] = [];
    const allVisits: any[] = [];

    // Collect all member user IDs first for targeted query
    const { data: membersData } = await supabase
      .from('members')
      .select('aptus_user_id, parakey_user_id')
      .neq('is_system_account', true);

    const allUserIds = new Set<string>();
    membersData?.forEach(m => {
      if (m.aptus_user_id) allUserIds.add(m.aptus_user_id);
      if (m.parakey_user_id) allUserIds.add(m.parakey_user_id);
    });

    if (allUserIds.size === 0) {
      return { recent: [], all: [] };
    }

    const userIdArray = Array.from(allUserIds);

    // Fetch recent visits (last 30 days) in parallel with all visits
    const [recentResult, allResult] = await Promise.all([
      // Recent visits (for 30-day stats)
      (async () => {
        let visits: any[] = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
          const { data } = await supabase
            .from('visits')
            .select('userid')
            .in('userid', userIdArray)
            .gte('eventtime', thirtyDaysAgo.toISOString())
            .range(from, from + pageSize - 1);

          if (!data || data.length === 0) break;
          visits = visits.concat(data);
          if (data.length < pageSize) break;
          from += pageSize;
        }
        return visits;
      })(),

      // All visits (for total count and last visit)
      (async () => {
        let visits: any[] = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
          const { data } = await supabase
            .from('visits')
            .select('userid, eventtime')
            .in('userid', userIdArray)
            .order('eventtime', { ascending: false })
            .range(from, from + pageSize - 1);

          if (!data || data.length === 0) break;
          visits = visits.concat(data);
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
      const [membersResult, visitsResult, phoneResult, relationsResult] = await Promise.all([
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
          .select('medbadare_member_id, primary_member_id')
      ]);

      const membersData = membersResult;
      console.log(`✅ Loaded ${membersData.length} members`);

      // Process visits
      const { recent: recentVisits, all: allVisits } = visitsResult;

      // Count visits per user for last 30 days
      const visitCounts = new Map<string, number>();
      recentVisits.forEach(v => {
        visitCounts.set(v.userid, (visitCounts.get(v.userid) || 0) + 1);
      });

      // Count total visits and find last visit
      const totalVisitsMap = new Map<string, number>();
      const lastVisitMap = new Map<string, string>();
      allVisits.forEach(v => {
        totalVisitsMap.set(v.userid, (totalVisitsMap.get(v.userid) || 0) + 1);
        if (!lastVisitMap.has(v.userid)) {
          lastVisitMap.set(v.userid, v.eventtime);
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

      // Merge member data with visit counts and phone numbers
      const membersWithVisits = membersData
        .filter(m => !m.is_system_account)
        .map(m => {
          const phoneInfo = phoneMap.get(m.id);

          // Calculate total visits from both aptus and parakey
          const totalVisits =
            (m.aptus_user_id ? totalVisitsMap.get(m.aptus_user_id) || 0 : 0) +
            (m.parakey_user_id ? totalVisitsMap.get(m.parakey_user_id) || 0 : 0);

          // Find most recent visit from either system
          const aptusLastVisit = m.aptus_user_id ? lastVisitMap.get(m.aptus_user_id) : null;
          const parakeyLastVisit = m.parakey_user_id ? lastVisitMap.get(m.parakey_user_id) : null;
          let lastVisit = null;

          if (aptusLastVisit && parakeyLastVisit) {
            lastVisit = aptusLastVisit > parakeyLastVisit ? aptusLastVisit : parakeyLastVisit;
          } else {
            lastVisit = aptusLastVisit || parakeyLastVisit;
          }

          return {
            ...m,
            full_name: `${m.first_name} ${m.last_name || ''}`,
            phone: phoneInfo?.phone || null,
            phone_type: phoneInfo?.type || null,
            visits_last_month:
              (m.aptus_user_id ? visitCounts.get(m.aptus_user_id) || 0 : 0) +
              (m.parakey_user_id ? visitCounts.get(m.parakey_user_id) || 0 : 0),
            visits_total: totalVisits,
            last_visit_at: lastVisit,
            related_members: relationsMap.get(m.id) || [],
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
          <Route
            path="/"
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
            path="/medlem/:id"
            element={<MemberDetail />}
          />
          <Route
            path="/parakey-mapping"
            element={<ParakeyMapping />}
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
          </Routes>
        </Suspense>
      </DashboardLayout>
    </SidebarProvider>
  );
}

export default App;
