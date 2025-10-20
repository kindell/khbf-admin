import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Users, ArrowRight } from 'lucide-react';
import { InfoSection } from './ios/InfoSection';
import { InfoRow } from './ios/InfoRow';

interface RelatedMember {
  id: string;
  fortnox_customer_number: string;
  first_name: string;
  last_name: string;
  relation_type: string;
  last_visit_at?: string | null;
  visits_last_month?: number;
}

interface RelatedMembersProps {
  memberId: string;
}

export function RelatedMembers({ memberId }: RelatedMembersProps) {
  const navigate = useNavigate();
  const [medbadare, setMedbadare] = useState<RelatedMember[]>([]);
  const [primaryMember, setPrimaryMember] = useState<RelatedMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRelations() {
      try {
        // Check if this member is a primary member (has medbadare)
        const { data: medbadareRelations } = await supabase
          .from('member_relations')
          .select('relation_type, medbadare_member_id')
          .eq('primary_member_id', memberId);

        if (medbadareRelations && medbadareRelations.length > 0) {
          // Fetch member details for medbadare with visit stats
          const medbadareIds = medbadareRelations.map(r => r.medbadare_member_id);
          const { data: medbadareMembers } = await supabase
            .from('members')
            .select('id, fortnox_customer_number, first_name, last_name, last_visit_at, visits_last_month')
            .in('id', medbadareIds);

          if (medbadareMembers) {
            const enrichedMedbadare = medbadareMembers.map(member => {
              const relation = medbadareRelations.find(r => r.medbadare_member_id === member.id);
              return {
                ...member,
                relation_type: relation?.relation_type || 'UNKNOWN'
              };
            });
            setMedbadare(enrichedMedbadare);
          }
        }

        // Check if this member is a medbadare (has a primary member)
        const { data: primaryRelation } = await supabase
          .from('member_relations')
          .select('relation_type, primary_member_id')
          .eq('medbadare_member_id', memberId)
          .maybeSingle();

        if (primaryRelation) {
          // Fetch primary member details with visit stats
          const { data: primaryMemberData } = await supabase
            .from('members')
            .select('id, fortnox_customer_number, first_name, last_name, last_visit_at, visits_last_month')
            .eq('id', primaryRelation.primary_member_id)
            .single();

          if (primaryMemberData) {
            setPrimaryMember({
              ...primaryMemberData,
              relation_type: primaryRelation.relation_type
            });
          }
        }
      } catch (error) {
        console.error('Error fetching relations:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchRelations();
  }, [memberId]);

  if (loading) return null;
  if (!primaryMember && medbadare.length === 0) return null;

  const relationLabel = (type: string) =>
    type === 'HOUSEHOLD' ? 'Hushåll' : type;

  return (
    <>
      {/* iOS Mobile View */}
      <div className="lg:hidden">
        <InfoSection title="RELATERADE MEDLEMMAR">
          {/* If this is a medbadare, show the primary member */}
          {primaryMember && (
            <InfoRow
              icon={<Users className="h-5 w-5" />}
              label="Medbadare till"
              value={
                <div className="text-right">
                  <div className="font-medium">{primaryMember.first_name} {primaryMember.last_name}</div>
                  <div className="text-[13px] text-gray-400">
                    #{primaryMember.fortnox_customer_number}
                    {primaryMember.visits_last_month !== undefined && (
                      <span className="ml-2">• {primaryMember.visits_last_month} besök/mån</span>
                    )}
                  </div>
                  {primaryMember.last_visit_at && (
                    <div className="text-[11px] text-gray-400">
                      Senast: {new Date(primaryMember.last_visit_at).toLocaleDateString('sv-SE')}
                    </div>
                  )}
                </div>
              }
              onClick={() => navigate(`/medlem/${primaryMember.id}`, { state: { animationDirection: 'forward' } })}
            />
          )}

          {/* If this is a primary member, show their medbadare */}
          {medbadare.map((mb) => (
            <InfoRow
              key={mb.id}
              icon={<Users className="h-5 w-5" />}
              label="Medbadare"
              value={
                <div className="text-right">
                  <div className="font-medium">{mb.first_name} {mb.last_name}</div>
                  <div className="text-[13px] text-gray-400">
                    #{mb.fortnox_customer_number}
                    {mb.visits_last_month !== undefined && (
                      <span className="ml-2">• {mb.visits_last_month} besök/mån</span>
                    )}
                  </div>
                  {mb.last_visit_at && (
                    <div className="text-[11px] text-gray-400">
                      Senast: {new Date(mb.last_visit_at).toLocaleDateString('sv-SE')}
                    </div>
                  )}
                </div>
              }
              onClick={() => navigate(`/medlem/${mb.id}`, { state: { animationDirection: 'forward' } })}
            />
          ))}
        </InfoSection>
      </div>

      {/* Desktop Card View */}
      <Card className="hidden lg:block">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Relaterade medlemmar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* If this is a medbadare, show the primary member */}
          {primaryMember && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Medbadare till:
              </p>
              <div
                onClick={() => navigate(`/medlem/${primaryMember.id}`, { state: { animationDirection: 'forward' } })}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium">
                    {primaryMember.first_name} {primaryMember.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Kundnr: {primaryMember.fortnox_customer_number}
                  </p>
                  {(primaryMember.visits_last_month !== undefined || primaryMember.last_visit_at) && (
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      {primaryMember.visits_last_month !== undefined && (
                        <span>{primaryMember.visits_last_month} besök/mån</span>
                      )}
                      {primaryMember.last_visit_at && (
                        <span>Senast: {new Date(primaryMember.last_visit_at).toLocaleDateString('sv-SE')}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {relationLabel(primaryMember.relation_type)}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          )}

          {/* If this is a primary member, show their medbadare */}
          {medbadare.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Har {medbadare.length} medbadare:
              </p>
              <div className="space-y-2">
                {medbadare.map((mb) => (
                  <div
                    key={mb.id}
                    onClick={() => navigate(`/medlem/${mb.id}`, { state: { animationDirection: 'forward' } })}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium">
                        {mb.first_name} {mb.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Kundnr: {mb.fortnox_customer_number}
                      </p>
                      {(mb.visits_last_month !== undefined || mb.last_visit_at) && (
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          {mb.visits_last_month !== undefined && (
                            <span>{mb.visits_last_month} besök/mån</span>
                          )}
                          {mb.last_visit_at && (
                            <span>Senast: {new Date(mb.last_visit_at).toLocaleDateString('sv-SE')}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {relationLabel(mb.relation_type)}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
