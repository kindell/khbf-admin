import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { supabase, type Member } from './lib/supabase';
import MemberList from './MemberList';
import MemberDetail from './MemberDetail';
import ParakeyMapping from './ParakeyMapping';
import { DashboardLayout } from './components/DashboardLayout';
import { StatsCard } from './components/StatsCard';
import { Users, UserCheck, Activity, TrendingUp } from 'lucide-react';

export type Period = 'week' | 'month' | '3months';

function App() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchMembers();

    // Auto-refresh every 30 seconds to keep data fresh
    const intervalId = setInterval(() => {
      fetchMembers(false); // Don't show loading spinner for auto-refresh
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  async function fetchMembers(showLoading = true) {
    if (showLoading) setLoading(true);

    // Fetch ALL members from members table (remove default 1000 limit)
    let allMembers: any[] = [];
    let memberFrom = 0;
    const memberPageSize = 1000;

    while (true) {
      const { data: membersPage, error } = await supabase
        .from('members')
        .select('*')
        .order('fortnox_customer_number')
        .range(memberFrom, memberFrom + memberPageSize - 1);

      if (error) {
        console.error('Error fetching members:', error);
        setLoading(false);
        return;
      }

      if (!membersPage || membersPage.length === 0) break;
      allMembers = allMembers.concat(membersPage);
      if (membersPage.length < memberPageSize) break;
      memberFrom += memberPageSize;
    }

    const membersData = allMembers;
    console.log(`Loaded ${membersData.length} members`);

    // Fetch visit counts for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch ALL visits (remove default 1000 limit)
    let allVisits: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data: visits } = await supabase
        .from('visits')
        .select('userid')
        .gte('eventtime', thirtyDaysAgo.toISOString())
        .range(from, from + pageSize - 1);

      if (!visits || visits.length === 0) break;
      allVisits = allVisits.concat(visits);
      if (visits.length < pageSize) break;
      from += pageSize;
    }

    // Count visits per user
    const visitCounts = new Map<string, number>();
    allVisits.forEach(v => {
      visitCounts.set(v.userid, (visitCounts.get(v.userid) || 0) + 1);
    });

    console.log(`Loaded ${allVisits.length} visits from last 30 days`);

    // Fetch all phone numbers with type
    const { data: phoneData } = await supabase
      .from('phone_mappings')
      .select('member_id, phone_number, phone_type, is_primary')
      .eq('is_primary', true);

    const phoneMap = new Map<string, { phone: string; type: string }>();
    phoneData?.forEach(p => {
      phoneMap.set(p.member_id, { phone: p.phone_number, type: p.phone_type });
    });

    // Collect all user IDs for visit stats lookup
    const allUserIds = new Set<string>();
    membersData.forEach(m => {
      if (m.aptus_user_id) allUserIds.add(m.aptus_user_id);
      if (m.parakey_user_id) allUserIds.add(m.parakey_user_id);
    });

    // Fetch total visit counts and last visit per user
    const totalVisitsMap = new Map<string, number>();
    const lastVisitMap = new Map<string, string>();

    if (allUserIds.size > 0) {
      const userIdArray = Array.from(allUserIds);

      // Fetch ALL visits for these users with pagination
      let allUserVisits: any[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data: visits } = await supabase
          .from('visits')
          .select('userid, eventtime')
          .in('userid', userIdArray)
          .order('eventtime', { ascending: false })
          .range(from, from + pageSize - 1);

        if (!visits || visits.length === 0) break;
        allUserVisits = allUserVisits.concat(visits);
        if (visits.length < pageSize) break;
        from += pageSize;
      }

      // Count total visits and find last visit per user
      allUserVisits.forEach(v => {
        // Count total
        totalVisitsMap.set(v.userid, (totalVisitsMap.get(v.userid) || 0) + 1);

        // Track last visit (visits are already sorted by eventtime desc)
        if (!lastVisitMap.has(v.userid)) {
          lastVisitMap.set(v.userid, v.eventtime);
        }
      });

      console.log(`Loaded ${allUserVisits.length} total visits for ${totalVisitsMap.size} users`);
    }

    // Merge member data with visit counts and phone numbers
    // Filter out system accounts (is_system_account = true)
    const membersWithVisits = membersData
      ?.filter(m => !m.is_system_account)
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
        };
      }) || [];

    console.log('Fetched members:', membersWithVisits.length, 'members');
    setMembers(membersWithVisits);
    if (showLoading) setLoading(false);
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Laddar medlemmar...</p>
        </div>
      </DashboardLayout>
    );
  }

  // Calculate stats
  const totalMembers = members.length;
  const activeMembers = members.filter(m => m.aptus_user_id || m.parakey_user_id).length;
  const totalVisitsThisMonth = members.reduce((sum, m) => sum + (m.visits_last_month || 0), 0);
  const avgVisitsPerMember = totalMembers > 0 ? Math.round(totalVisitsThisMonth / totalMembers) : 0;

  return (
    <DashboardLayout>
      <Routes>
        <Route
          path="/"
          element={
            <>
              {/* Stats Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
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
                  description="Per medlem senaste månaden"
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
          element={<MemberDetail members={members} />}
        />
        <Route
          path="/parakey-mapping"
          element={<ParakeyMapping />}
        />
      </Routes>
    </DashboardLayout>
  );
}

export default App;
