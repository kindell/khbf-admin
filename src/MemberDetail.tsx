import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, type Member } from './lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Separator } from './components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { ArrowLeft, CreditCard, Smartphone, Key, Calendar, MessageSquare, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { RelatedMembers } from './components/RelatedMembers';
import { getMemberCategory, getCategoryBadgeVariant } from './lib/member-categories';
import { MemberDetailSkeleton } from './components/MemberDetailSkeleton';

interface PhoneMapping {
  phone_number: string;
  phone_type: string;
  is_primary: boolean;
}

interface EmailInfo {
  email: string;
  source: string;
  is_primary: boolean;
}

interface Visit {
  id: string;
  eventtime: string;
  department: string;
  groupsize: number;
  accesscredential: string | null;
}

interface AccessInfo {
  has_rfid: boolean;
  has_parakey: boolean;
  has_aptus: boolean;
  rfid_cards: RFIDCardInfo[];
  parakey_email: string | null;
  parakey_dept_stats: { gents: number; ladies: number } | null;
  aptus_keys: AptusKey[];
}

interface AptusKey {
  card: string;
  name: string;
  blocked: boolean;
  f1: string | null;
  total_uses: number;
  herrar_uses: number;
  damer_uses: number;
  first_used: string | null;
  last_used: string | null;
}

interface RFIDCardInfo {
  card_number: string;
  total_uses: number;
  herrar_uses: number;
  damer_uses: number;
  last_used: string | null;
  first_used: string | null;
}

interface Invoice {
  DocumentNumber: string;
  InvoiceDate: string;
  DueDate: string;
  Total: number;
  Balance: number;
  Cancelled: boolean;
  Sent: boolean;
  InvoiceType: string;
}

interface ThreadData {
  id: string;
  phone_number: string;
  member_name: string | null;
  last_message_text: string;
  last_message_at: string;
  unread_count: number;
}

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [phones, setPhones] = useState<PhoneMapping[]>([]);
  const [emails, setEmails] = useState<EmailInfo[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [accessInfo, setAccessInfo] = useState<AccessInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [smsThreadId, setSmsThreadId] = useState<string | null>(null);
  const [threadData, setThreadData] = useState<ThreadData | null>(null);

  const [member, setMember] = useState<Member | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [accessExpanded, setAccessExpanded] = useState(true);
  const [invoicesExpanded, setInvoicesExpanded] = useState(false);

  // Smart back button: use browser history if available, otherwise go to home
  const handleBack = () => {
    // Check if there's history to go back to (not a direct link)
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  // Update page title when member data loads
  useEffect(() => {
    if (member) {
      document.title = `${member.first_name} ${member.last_name} | KHbf Admin`;
    } else {
      document.title = 'Medlem | KHbf Admin';
    }

    // Cleanup: reset title when component unmounts
    return () => {
      document.title = 'KHbf Admin';
    };
  }, [member]);

  useEffect(() => {
    if (id) {
      loadAllData();
    }
  }, [id]);

  async function loadAllData() {
    if (!id) return;

    setLoading(true);

    // Fetch fresh member data directly from members table
    const { data: memberData } = await supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .single();

    if (!memberData) {
      setLoading(false);
      return;
    }

    // Add full_name for compatibility
    const memberWithFullName = {
      ...memberData,
      full_name: `${memberData.first_name} ${memberData.last_name || ''}`
    } as Member;

    setMember(memberWithFullName);

    // Now fetch all details with the fresh member data
    await fetchMemberDetails(memberWithFullName);
  }

  async function fetchMemberDetails(currentMember: Member) {
    if (!id || !currentMember) return;

    // DEBUG: Check email mappings for this member
    const { data: debugMappings } = await supabase
      .from('email_mappings')
      .select('*')
      .eq('member_id', id);
    console.log('=== EMAIL MAPPINGS DEBUG ===');
    console.log('Member ID:', id);
    console.log('Member email:', currentMember.email);
    console.log('Parakey user ID:', currentMember.parakey_user_id);
    console.log('Email mappings found:', debugMappings);

    // Fetch phone numbers
    const { data: phoneData } = await supabase
      .from('phone_mappings')
      .select('phone_number, phone_type, is_primary')
      .eq('member_id', id)
      .order('is_primary', { ascending: false });

    setPhones(phoneData || []);

    // Check for SMS thread - look for primary mobile number
    const primaryMobile = phoneData?.find(p => p.is_primary && p.phone_type === 'mobile');
    if (primaryMobile) {
      const { data: thread } = await supabase
        .from('sms_threads')
        .select(`
          id,
          phone_number,
          last_message_at,
          last_message_text,
          unread_count
        `)
        .eq('phone_number', primaryMobile.phone_number)
        .eq('has_user_messages', true)
        .single();

      if (thread) {
        setSmsThreadId(thread.id);
        setThreadData({
          ...thread,
          member_name: currentMember.full_name
        });
      } else {
        setSmsThreadId(null);
        setThreadData(null);
      }
    }

    // Collect all email addresses
    const emailList: EmailInfo[] = [];

    // Add primary email from members table
    if (currentMember.email) {
      emailList.push({
        email: currentMember.email,
        source: 'Fortnox',
        is_primary: true
      });
    }

    // Add Parakey email if different
    if (currentMember.parakey_user_id) {
      const { data: parakeyUser } = await supabase
        .from('parakey_users')
        .select('email')
        .eq('id', currentMember.parakey_user_id)
        .single();

      if (parakeyUser?.email && parakeyUser.email !== currentMember.email) {
        emailList.push({
          email: parakeyUser.email,
          source: 'Parakey',
          is_primary: false
        });
      }
    }

    setEmails(emailList);

    // Fetch recent visits (last 90 days) using user IDs
    const userIds = [currentMember.aptus_user_id, currentMember.parakey_user_id].filter(Boolean);

    const { data: visitData } = await supabase
      .from('visits')
      .select('id, eventtime, department, groupsize, accesscredential')
      .in('userid', userIds)
      .gte('eventtime', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('eventtime', { ascending: false })
      .limit(50);

    setVisits(visitData || []);

    // Fetch access information with detailed RFID statistics
    const rfidCardsInfo: RFIDCardInfo[] = [];

    // Group visits by card and calculate statistics (needed for Aptus keys later)
    const cardStats = new Map<string, {
      total: number;
      herrar: number;
      damer: number;
      first: string;
      last: string;
    }>();

    if (currentMember.aptus_user_id) {
      // Get all visits with RFID cards for this user
      const { data: rfidVisits } = await supabase
        .from('visits')
        .select('accesscredential, department, eventtime')
        .eq('userid', currentMember.aptus_user_id)
        .not('accesscredential', 'is', null)
        .order('eventtime', { ascending: true });

      rfidVisits?.forEach(visit => {
        const card = visit.accesscredential;
        if (!card) return;

        const stats = cardStats.get(card) || {
          total: 0,
          herrar: 0,
          damer: 0,
          first: visit.eventtime,
          last: visit.eventtime
        };

        stats.total++;
        if (visit.department === 'GENTS' || visit.department === 'Herrar') stats.herrar++;
        if (visit.department === 'LADIES' || visit.department === 'Damer') stats.damer++;
        stats.last = visit.eventtime;

        cardStats.set(card, stats);
      });

      // Get all cards from aptus_users if fortnox_customer_number exists
      if (currentMember.fortnox_customer_number) {
        const { data: aptusCards } = await supabase
          .from('aptus_users')
          .select('card')
          .eq('f0', currentMember.fortnox_customer_number)
          .not('card', 'is', null);

        // Create RFIDCardInfo for all cards from aptus_users
        aptusCards?.forEach(aptusCard => {
          const card = aptusCard.card;
          const stats = cardStats.get(card);

          rfidCardsInfo.push({
            card_number: card,
            total_uses: stats?.total || 0,
            herrar_uses: stats?.herrar || 0,
            damer_uses: stats?.damer || 0,
            first_used: stats?.first || null,
            last_used: stats?.last || null
          });
        });
      } else {
        // If no fortnox_customer_number, show cards from visits only
        cardStats.forEach((stats, card) => {
          rfidCardsInfo.push({
            card_number: card,
            total_uses: stats.total,
            herrar_uses: stats.herrar,
            damer_uses: stats.damer,
            first_used: stats.first,
            last_used: stats.last
          });
        });
      }

      // Sort by most used, then by card number
      rfidCardsInfo.sort((a, b) => {
        if (b.total_uses !== a.total_uses) {
          return b.total_uses - a.total_uses;
        }
        return a.card_number.localeCompare(b.card_number);
      });
    }

    // Check for Parakey access using parakey_user_id
    let parakeyEmail = null;
    let parakeyDeptStats = null;
    if (currentMember.parakey_user_id) {
      const { data: parakeyUser } = await supabase
        .from('parakey_users')
        .select('email')
        .eq('id', currentMember.parakey_user_id)
        .single();

      parakeyEmail = parakeyUser?.email || null;

      // Get department statistics for Parakey visits (userid = parakey_user_id for Parakey visits)
      if (currentMember.parakey_user_id && parakeyEmail) {
        const { data: parakeyVisits } = await supabase
          .from('visits')
          .select('department')
          .eq('userid', currentMember.parakey_user_id)
          .eq('accesscredential', parakeyEmail);

        if (parakeyVisits && parakeyVisits.length > 0) {
          const gents = parakeyVisits.filter(v => v.department === 'GENTS' || v.department === 'Herrar').length;
          const ladies = parakeyVisits.filter(v => v.department === 'LADIES' || v.department === 'Damer').length;
          parakeyDeptStats = { gents, ladies };
        }
      }
    }

    // Fetch Aptus keys using fortnox_customer_number and combine with visit statistics
    const aptusKeys: AptusKey[] = [];
    if (currentMember.fortnox_customer_number && currentMember.aptus_user_id) {
      // cardStats was already built from visits above
      const { data: aptusData } = await supabase
        .from('aptus_users')
        .select('card, name, blocked, f1')
        .eq('f0', currentMember.fortnox_customer_number);

      if (aptusData) {
        aptusData.forEach(aptusCard => {
          const stats = cardStats.get(aptusCard.card);
          aptusKeys.push({
            ...aptusCard,
            total_uses: stats?.total || 0,
            herrar_uses: stats?.herrar || 0,
            damer_uses: stats?.damer || 0,
            first_used: stats?.first || null,
            last_used: stats?.last || null
          });
        });
      }
    }

    setAccessInfo({
      has_rfid: false, // Deprecated, kept for backwards compatibility
      has_parakey: !!parakeyEmail,
      has_aptus: aptusKeys.length > 0,
      rfid_cards: [], // Deprecated, kept for backwards compatibility
      parakey_email: parakeyEmail,
      parakey_dept_stats: parakeyDeptStats,
      aptus_keys: aptusKeys
    });

    // Fetch invoices directly from Supabase
    if (currentMember.fortnox_customer_number) {
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('*')
        .eq('fortnox_customer_number', currentMember.fortnox_customer_number)
        .order('invoice_date', { ascending: false });

      if (invoiceData) {
        // Map database format to component format
        const mappedInvoices: Invoice[] = invoiceData.map(inv => ({
          DocumentNumber: inv.fortnox_invoice_number,
          InvoiceDate: inv.invoice_date,
          DueDate: inv.due_date || '',
          Total: inv.total,
          Balance: 0, // Assume paid (since we only sync booked invoices)
          Cancelled: inv.cancelled,
          Sent: true, // Assume sent if booked
          InvoiceType: inv.invoice_type || 'INVOICE'
        }));
        setInvoices(mappedInvoices);
      }
    }

    setLoading(false);
  }

  if (loading) {
    return <MemberDetailSkeleton />;
  }

  if (!member) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tillbaka
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Medlem hittades inte</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Win 1 & 3: Enhanced header with SMS button and access icons */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tillbaka
        </Button>

        {/* Quick Win 1: SMS button in header */}
        {phones.some(p => p.phone_type === 'mobile') && !threadData && (
          <Button onClick={() => {
            const primaryMobile = phones.find(p => p.is_primary && p.phone_type === 'mobile');
            if (primaryMobile && member) {
              navigate('/messages/new', {
                state: {
                  prefilledRecipient: {
                    id: member.id,
                    name: member.full_name,
                    phone: primaryMobile.phone_number,
                    type: 'member'
                  }
                }
              });
            }
          }}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Skicka SMS
          </Button>
        )}

        {/* Show SMS conversation if exists */}
        {threadData && (
          <Button
            variant="outline"
            onClick={() => navigate(`/messages/${smsThreadId}`)}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            SMS-konversation
            {threadData.unread_count > 0 && (
              <Badge className="ml-2 bg-red-500">{threadData.unread_count}</Badge>
            )}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{member.full_name}</h1>
          {/* Quick Win 3: Access status icons in header */}
          {member.parakey_user_id && (
            <Smartphone className="h-5 w-5 text-blue-500"  />
          )}
          {member.aptus_user_id && (
            <CreditCard className="h-5 w-5 text-green-500"  />
          )}
        </div>
        <p className="text-muted-foreground">
          Kundnummer: {member.fortnox_customer_number}
        </p>
      </div>

      {/* Quick Win 2: Consolidated Member & Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Medlem & Kontakt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Member info first */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Kategori</span>
            <Badge variant={getCategoryBadgeVariant(getMemberCategory(member))}>
              {getMemberCategory(member)}
            </Badge>
          </div>

          {member.personal_identity_number && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Personnummer</span>
              <span className="text-sm">{member.personal_identity_number}</span>
            </div>
          )}

          <Separator />

          {/* Contact information */}
          {emails.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">E-post</p>
              <div className="space-y-1">
                {emails.map((email, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm">{email.email}</span>
                    <Badge variant="outline" className="ml-2 text-xs">
                      {email.source}
                      {email.is_primary && ' (primär)'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phones.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Telefon</p>
              <div className="space-y-1">
                {phones.map((phone, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm">
                      {phone.phone_type === 'mobile' ? '📱 ' : phone.phone_type === 'landline' ? '☎️ ' : ''}
                      {phone.phone_number}
                    </span>
                    {phone.is_primary && (
                      <Badge variant="outline" className="ml-2 text-xs">primär</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(member.address || member.postal_code || member.city) && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Adress</p>
                <p className="text-sm">
                  {member.address || '-'}
                  {member.postal_code && member.city && (
                    <>
                      <br />
                      {member.postal_code} {member.city}
                    </>
                  )}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Related Members */}
      <RelatedMembers memberId={id!} />

      {!loading && accessInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Accessmetoder
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!accessInfo.has_parakey && !accessInfo.has_aptus ? (
              <p className="text-sm text-muted-foreground">Inga accessmetoder registrerade</p>
            ) : (
              <div className="space-y-4">
                {/* Summary - always visible */}
                <div className="flex items-center gap-3 text-sm">
                  {accessInfo.has_parakey && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />
                      Parakey
                    </Badge>
                  )}
                  {accessInfo.has_aptus && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Key className="h-3 w-3" />
                      {accessInfo.aptus_keys.length} RFID-kort
                    </Badge>
                  )}
                </div>

                {/* Expand/Collapse button */}
                <Button
                  variant="ghost"
                  onClick={() => setAccessExpanded(!accessExpanded)}
                  className="w-full flex items-center justify-between p-4 -mx-4 hover:bg-muted/50"
                  aria-expanded={accessExpanded}
                  aria-controls="access-details"
                >
                  <span className="font-semibold">
                    {accessExpanded ? 'Dölj detaljer' : 'Visa detaljer'}
                  </span>
                  {accessExpanded ? (
                    <ChevronUp className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-5 w-5" aria-hidden="true" />
                  )}
                </Button>

                {/* Detailed content - collapsible */}
                {accessExpanded && (
                  <div id="access-details" className="space-y-6 pt-2" role="region" aria-label="Access method details">
                    {accessInfo.has_parakey && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-semibold">Parakey Mobil-app</h4>
                        </div>
                        <div className="rounded-lg border p-3 space-y-2">
                          <p className="text-sm">{accessInfo.parakey_email}</p>
                          {accessInfo.parakey_dept_stats && (
                            <div className="flex gap-4 text-sm">
                              <span>
                                ♂️ Herrar: <strong>{accessInfo.parakey_dept_stats.gents}</strong> besök
                              </span>
                              <span>
                                ♀️ Damer: <strong>{accessInfo.parakey_dept_stats.ladies}</strong> besök
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {accessInfo.has_aptus && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-semibold">Aptus-nycklar (RFID) ({accessInfo.aptus_keys.length})</h4>
                        </div>
                        <div className="space-y-2">
                          {accessInfo.aptus_keys.map((key, idx) => (
                            <div key={idx} className="rounded-lg border p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="font-mono text-sm font-medium">{key.card}</div>
                                {key.blocked && (
                                  <Badge variant="destructive">
                                    🚫 Blockerad
                                  </Badge>
                                )}
                              </div>
                              {key.f1 && <p className="text-sm text-muted-foreground">{key.f1}</p>}
                              {key.total_uses > 0 ? (
                                <>
                                  <div className="flex gap-4 text-sm">
                                    <span>
                                      Totalt: <strong>{key.total_uses}</strong> besök
                                    </span>
                                    <span>
                                      ♂️ <strong>{key.herrar_uses}</strong>
                                    </span>
                                    <span>
                                      ♀️ <strong>{key.damer_uses}</strong>
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Senast använd: {new Date(key.last_used!).toLocaleDateString('sv-SE')}
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm text-muted-foreground">Aldrig använd</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Besök & Aktivitet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Visit statistics */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Senaste veckan</p>
              <p className="text-2xl font-bold">
                {(() => {
                  const weekVisits = visits.filter(v =>
                    new Date(v.eventtime) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  );
                  const gents = weekVisits.filter(v => v.department === 'GENTS' || v.department === 'Herrar').length;
                  const ladies = weekVisits.filter(v => v.department === 'LADIES' || v.department === 'Damer').length;
                  return (
                    <>
                      {weekVisits.length}{' '}
                      <span className="text-sm font-normal text-muted-foreground">
                        (♂️{gents} ♀️{ladies})
                      </span>
                    </>
                  );
                })()}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Senaste månaden</p>
              <p className="text-2xl font-bold">
                {(() => {
                  const monthVisits = visits.filter(v =>
                    new Date(v.eventtime) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                  );
                  const gents = monthVisits.filter(v => v.department === 'GENTS' || v.department === 'Herrar').length;
                  const ladies = monthVisits.filter(v => v.department === 'LADIES' || v.department === 'Damer').length;
                  return (
                    <>
                      {monthVisits.length}{' '}
                      <span className="text-sm font-normal text-muted-foreground">
                        (♂️{gents} ♀️{ladies})
                      </span>
                    </>
                  );
                })()}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Senaste 3 månaderna</p>
              <p className="text-2xl font-bold">
                {(() => {
                  const threeMonthVisits = visits.filter(v =>
                    new Date(v.eventtime) >= new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                  );
                  const gents = threeMonthVisits.filter(v => v.department === 'GENTS' || v.department === 'Herrar').length;
                  const ladies = threeMonthVisits.filter(v => v.department === 'LADIES' || v.department === 'Damer').length;
                  return (
                    <>
                      {threeMonthVisits.length}{' '}
                      <span className="text-sm font-normal text-muted-foreground">
                        (♂️{gents} ♀️{ladies})
                      </span>
                    </>
                  );
                })()}
              </p>
            </div>
          </div>

          {/* First and last visit dates */}
          {member.last_visit_at && (
            <>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Senaste besök</p>
                  <p className="text-sm">
                    {new Date(member.last_visit_at).toLocaleDateString('sv-SE', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Europe/Stockholm'
                    })}
                  </p>
                </div>
                {member.first_visit_at && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Första besök</p>
                    <p className="text-sm">
                      {new Date(member.first_visit_at).toLocaleDateString('sv-SE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        timeZone: 'Europe/Stockholm'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Collapsible calendar */}
          {!loading && visits.length > 0 && (
            <>
              <Separator />
              <div>
                <Button
                  variant="ghost"
                  onClick={() => setCalendarExpanded(!calendarExpanded)}
                  className="w-full flex items-center justify-between p-4 -mx-4 hover:bg-muted/50"
                  aria-expanded={calendarExpanded}
                  aria-controls="visit-calendar"
                >
                  <span className="font-semibold">Besökskalender (senaste 4 veckorna)</span>
                  {calendarExpanded ? (
                    <ChevronUp className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-5 w-5" aria-hidden="true" />
                  )}
                </Button>

                {calendarExpanded && (
                  <div id="visit-calendar" className="mt-4 overflow-x-auto" role="region" aria-label="Visit calendar details">
                    {(() => {
                      // Group visits by date (Swedish timezone)
                      const visitsByDate = new Map<string, Visit[]>();
                      visits.forEach(visit => {
                        // Convert to Swedish date
                        const dateStr = new Date(visit.eventtime).toLocaleDateString('sv-SE', {
                          timeZone: 'Europe/Stockholm',
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        });
                        if (!visitsByDate.has(dateStr)) {
                          visitsByDate.set(dateStr, []);
                        }
                        visitsByDate.get(dateStr)!.push(visit);
                      });

                      // Generate last 4 weeks (Swedish timezone)
                      const weeks = [];
                      const nowInSweden = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));

                      // Find the most recent Sunday (end of week)
                      const mostRecentSunday = new Date(nowInSweden);
                      const dayOfWeek = mostRecentSunday.getDay(); // 0 = Sunday, 1 = Monday, etc.
                      const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
                      mostRecentSunday.setDate(mostRecentSunday.getDate() + daysToSunday);

                      for (let weekOffset = 3; weekOffset >= 0; weekOffset--) {
                        const weekDays = [];
                        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
                          const date = new Date(mostRecentSunday);
                          // Go back weekOffset weeks, then add dayOffset days (0=Monday, 6=Sunday)
                          date.setDate(date.getDate() - (weekOffset * 7) - (6 - dayOffset));
                          const dateKey = date.toLocaleDateString('sv-SE', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          });
                          const dayVisits = visitsByDate.get(dateKey) || [];
                          weekDays.push({ date, dateKey, visits: dayVisits });
                        }
                        weeks.push(weekDays);
                      }

                      return (
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="p-2 text-left font-medium">Vecka</th>
                              <th className="p-2 text-left font-medium">Mån</th>
                              <th className="p-2 text-left font-medium">Tis</th>
                              <th className="p-2 text-left font-medium">Ons</th>
                              <th className="p-2 text-left font-medium">Tor</th>
                              <th className="p-2 text-left font-medium">Fre</th>
                              <th className="p-2 text-left font-medium">Lör</th>
                              <th className="p-2 text-left font-medium">Sön</th>
                            </tr>
                          </thead>
                          <tbody>
                            {weeks.map((week, weekIndex) => {
                              // Calculate ISO week number
                              const firstDay = week[0].date;
                              const startOfYear = new Date(firstDay.getFullYear(), 0, 1);
                              const days = Math.floor((firstDay.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
                              const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);

                              return (
                                <tr key={weekIndex} className="border-b">
                                  <td className="p-2 text-muted-foreground font-medium">v.{weekNumber}</td>
                                  {week.map((day, dayIndex) => (
                                    <td
                                      key={dayIndex}
                                      className={`p-2 align-top ${day.visits.length > 0 ? 'bg-muted/50' : ''}`}
                                    >
                                      <div className="font-medium mb-1">
                                        {day.date.getDate()}
                                      </div>
                                      {day.visits.length > 0 && (
                                        <div className="space-y-0.5">
                                          {day.visits.map((visit, idx) => {
                                            // DB stores UTC without timezone marker, so we need to add 'Z'
                                            const utcTime = visit.eventtime.endsWith('Z') ? visit.eventtime : visit.eventtime + 'Z';
                                            const deptIcon = visit.department === 'GENTS' || visit.department === 'Herrar' ? '♂️' :
                                                            visit.department === 'LADIES' || visit.department === 'Damer' ? '♀️' : '';
                                            return (
                                              <div key={idx} className="text-xs text-muted-foreground">
                                                {deptIcon} {new Date(utcTime).toLocaleTimeString('sv-SE', {
                                                  hour: '2-digit',
                                                  minute: '2-digit',
                                                  timeZone: 'Europe/Stockholm'
                                                })}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!loading && invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fakturor ({invoices.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary - always visible */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Totalt belopp</p>
                <p className="text-2xl font-bold">
                  {invoices.reduce((sum, inv) => sum + inv.Total, 0).toLocaleString('sv-SE')} kr
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Betalda</p>
                <p className="text-2xl font-bold text-green-600">
                  {invoices.filter(inv => !inv.Cancelled && inv.Balance === 0).length}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Senaste faktura</p>
                <p className="text-sm font-medium">
                  {invoices[0]?.InvoiceDate || '-'}
                </p>
              </div>
            </div>

            {/* Expand/Collapse button */}
            <Button
              variant="ghost"
              onClick={() => setInvoicesExpanded(!invoicesExpanded)}
              className="w-full flex items-center justify-between p-4 -mx-4 hover:bg-muted/50"
              aria-expanded={invoicesExpanded}
              aria-controls="invoice-history"
            >
              <span className="font-semibold">
                {invoicesExpanded ? 'Dölj fakturahistorik' : 'Visa fakturahistorik'}
              </span>
              {invoicesExpanded ? (
                <ChevronUp className="h-5 w-5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-5 w-5" aria-hidden="true" />
              )}
            </Button>

            {/* Detailed table - collapsible */}
            {invoicesExpanded && (
              <div id="invoice-history" role="region" aria-label="Invoice history details">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fakturanr</TableHead>
                    <TableHead>Fakturadatum</TableHead>
                    <TableHead>Förfallodatum</TableHead>
                    <TableHead className="text-right">Belopp</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.DocumentNumber} className={invoice.Cancelled ? 'opacity-50' : ''}>
                      <TableCell className="font-mono text-sm">{invoice.DocumentNumber}</TableCell>
                      <TableCell>{invoice.InvoiceDate}</TableCell>
                      <TableCell>{invoice.DueDate}</TableCell>
                      <TableCell className="text-right">{invoice.Total.toLocaleString('sv-SE')} kr</TableCell>
                      <TableCell className="text-right">{invoice.Balance.toLocaleString('sv-SE')} kr</TableCell>
                      <TableCell>
                        {invoice.Cancelled ? (
                          <Badge variant="outline">Makulerad</Badge>
                        ) : invoice.Balance === 0 ? (
                          <Badge variant="secondary">Betald</Badge>
                        ) : (
                          <Badge variant="destructive">Obetald</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
