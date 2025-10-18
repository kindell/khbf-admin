import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';

interface UnmappedParakeyUser {
  id: string;
  email: string;
  name: string;
  recent_visits: number;
}

interface Member {
  id: string;
  fortnox_customer_number: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  aptus_user_id: string | null;
}

export default function ParakeyMapping() {
  const navigate = useNavigate();
  const [unmappedUsers, setUnmappedUsers] = useState<UnmappedParakeyUser[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedParakey, setSelectedParakey] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    // Get all parakey users with recent visits
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: parakeyUsers } = await supabase
      .from('parakey_users')
      .select('id, email, name');

    // Get ALL mapped emails (fetch with pagination to avoid 1000 row limit)
    let allMappings: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data: mappingsPage } = await supabase
        .from('email_mappings')
        .select('parakey_email')
        .range(from, from + pageSize - 1);

      if (!mappingsPage || mappingsPage.length === 0) break;
      allMappings = allMappings.concat(mappingsPage);
      if (mappingsPage.length < pageSize) break;
      from += pageSize;
    }

    console.log(`Loaded ${allMappings.length} email mappings`);
    console.log('Mapped emails:', allMappings.map(m => m.parakey_email));

    const mappedEmails = new Set(
      allMappings?.map(m => m.parakey_email.toLowerCase()) || []
    );

    console.log('Mapped emails set (lowercase):', Array.from(mappedEmails));

    // Filter to only unmapped users
    const unmapped = parakeyUsers?.filter(u => {
      const isUnmapped = !mappedEmails.has(u.email.toLowerCase());
      if (!isUnmapped) {
        console.log(`✓ ${u.email} is already mapped`);
      }
      return isUnmapped;
    }) || [];

    console.log(`Found ${unmapped.length} unmapped users out of ${parakeyUsers?.length} total parakey users`);
    if (unmapped.length > 0) {
      console.log('Unmapped emails:', unmapped.map(u => u.email));
    }

    // Get visit counts for each unmapped user (last 30 days)
    const unmappedWithVisits = await Promise.all(
      unmapped.map(async (user) => {
        const { count } = await supabase
          .from('visits')
          .select('*', { count: 'exact', head: true })
          .eq('userid', user.id)
          .gte('eventtime', thirtyDaysAgo.toISOString());

        return {
          ...user,
          recent_visits: count || 0
        };
      })
    );

    // Filter to only those with visits in last 30 days
    const activeUnmapped = unmappedWithVisits
      .filter(u => u.recent_visits > 0)
      .sort((a, b) => b.recent_visits - a.recent_visits);

    setUnmappedUsers(activeUnmapped);

    // Get all members with status and aptus_user_id to identify main members
    const { data: membersData } = await supabase
      .from('members')
      .select('id, fortnox_customer_number, first_name, last_name, email, status, aptus_user_id')
      .order('fortnox_customer_number');

    setMembers(membersData || []);
    setLoading(false);
  }

  async function saveMapping() {
    if (!selectedParakey || !selectedMember) {
      alert('Välj både Parakey-email och medlem');
      return;
    }

    setSaving(true);

    const parakeyUser = unmappedUsers.find(u => u.id === selectedParakey);
    const member = members.find(m => m.id === selectedMember);

    if (!parakeyUser || !member) {
      alert('Något gick fel');
      setSaving(false);
      return;
    }

    // Create mapping
    const mappingData = {
      member_id: member.id,
      parakey_email: parakeyUser.email,
      confidence: 'MANUAL',
      verified: true,
      verified_by: 'admin',
      verified_at: new Date().toISOString(),
      notes: `Manually mapped ${parakeyUser.email} to ${member.email}`
    };

    console.log('Creating mapping:', mappingData);

    const { data: insertedMapping, error: mappingError } = await supabase
      .from('email_mappings')
      .insert(mappingData)
      .select();

    if (mappingError) {
      console.error('Mapping error:', mappingError);
      alert('Fel vid skapande av mapping: ' + mappingError.message);
      setSaving(false);
      return;
    }

    console.log('Mapping created successfully:', insertedMapping);

    // Update member's parakey_user_id
    const { error: updateError } = await supabase
      .from('members')
      .update({ parakey_user_id: selectedParakey })
      .eq('id', selectedMember);

    if (updateError) {
      alert('Fel vid uppdatering av medlem: ' + updateError.message);
      setSaving(false);
      return;
    }

    alert(`✅ Mappning skapad!\n${parakeyUser.email} → ${member.email}`);

    // Reset and refresh after a small delay to ensure DB has updated
    setSelectedParakey(null);
    setSelectedMember(null);
    setMemberSearch('');
    setSaving(false);

    // Wait 500ms before refreshing to ensure database consistency
    setTimeout(() => {
      fetchData();
    }, 500);
  }

  if (loading) {
    return <div className="loading">Laddar...</div>;
  }

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <h1>Parakey Email-mappning</h1>
          <p style={{ marginTop: '0.5rem', color: '#666' }}>
            {unmappedUsers.length} omatchade Parakey-emails med besök senaste 30 dagarna
          </p>
        </div>
        <button className="close-button" onClick={() => navigate('/')}>
          ← Tillbaka
        </button>
      </header>

      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '2rem' }}>
          {/* Unmapped Parakey Users */}
          <div>
            <h2 style={{ marginBottom: '1rem' }}>Omatchade Parakey-emails</h2>
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              maxHeight: '600px',
              overflowY: 'auto'
            }}>
              {unmappedUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => {
                    setSelectedParakey(user.id);
                    setSelectedMember(null);
                    setMemberSearch(user.name);
                  }}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    backgroundColor: selectedParakey === user.id ? '#ebf8ff' : 'white',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>
                    {user.email}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                    {user.recent_visits} besök senaste 30 dagarna
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Members */}
          <div>
            <h2 style={{ marginBottom: '1rem' }}>Välj medlem</h2>
            <input
              type="text"
              placeholder="Sök medlem..."
              value={memberSearch}
              style={{
                width: '100%',
                padding: '0.75rem',
                marginBottom: '1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
              onChange={(e) => setMemberSearch(e.target.value)}
            />
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              maxHeight: '600px',
              overflowY: 'auto'
            }}>
              {members
                .filter(m => {
                  if (!memberSearch) return true;
                  const search = memberSearch.toLowerCase();
                  const fullName = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase();
                  return (
                    fullName.includes(search) ||
                    m.first_name?.toLowerCase().includes(search) ||
                    m.last_name?.toLowerCase().includes(search) ||
                    m.email?.toLowerCase().includes(search) ||
                    m.fortnox_customer_number?.includes(search)
                  );
                })
                .map((member) => (
                <div
                  key={member.id}
                  onClick={() => {
                    setSelectedMember(member.id);
                    if (!selectedParakey) {
                      setSelectedParakey(null);
                    }
                  }}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    backgroundColor: selectedMember === member.id ? '#ebf8ff' : 'white',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.25rem' }}>
                    <div style={{ fontWeight: 600 }}>
                      {member.first_name} {member.last_name}
                    </div>
                    {(member.status === 'ACTIVE' || member.aptus_user_id) && (
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.4rem',
                        backgroundColor: '#10b981',
                        color: 'white',
                        borderRadius: '4px',
                        fontWeight: 600
                      }}>
                        {member.status === 'ACTIVE' && member.aptus_user_id ? 'Betalande + RFID' :
                         member.status === 'ACTIVE' ? 'Betalande' : 'RFID'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>
                    {member.email || '-'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                    Kundnr: {member.fortnox_customer_number}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save button - third column */}
          <div style={{ paddingTop: 'calc(2rem + 1rem)' }}>
            <div style={{ position: 'sticky', top: '2rem' }}>
              <button
                onClick={saveMapping}
                disabled={saving || !selectedParakey || !selectedMember}
                style={{
                  padding: '1rem 2rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  backgroundColor: '#3182ce',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (saving || !selectedParakey || !selectedMember) ? 'not-allowed' : 'pointer',
                  opacity: (saving || !selectedParakey || !selectedMember) ? 0.4 : 1,
                  whiteSpace: 'nowrap'
                }}
              >
                {saving ? 'Sparar...' : 'Skapa mappning'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
