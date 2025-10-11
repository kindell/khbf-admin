import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Users, ArrowRight } from 'lucide-react';

interface RelatedMember {
  id: string;
  fortnox_customer_number: string;
  first_name: string;
  last_name: string;
  relation_type: string;
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
        const { data: medbadareData } = await supabase
          .from('member_relations')
          .select(`
            relation_type,
            medbadare:medbadare_member_id (
              id,
              fortnox_customer_number,
              first_name,
              last_name
            )
          `)
          .eq('primary_member_id', memberId);

        if (medbadareData) {
          setMedbadare(
            medbadareData.map((rel: any) => ({
              ...rel.medbadare,
              relation_type: rel.relation_type,
            }))
          );
        }

        // Check if this member is a medbadare (has a primary member)
        const { data: primaryData } = await supabase
          .from('member_relations')
          .select(`
            relation_type,
            primary:primary_member_id (
              id,
              fortnox_customer_number,
              first_name,
              last_name
            )
          `)
          .eq('medbadare_member_id', memberId)
          .single();

        if (primaryData) {
          setPrimaryMember({
            ...primaryData.primary,
            relation_type: primaryData.relation_type,
          });
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

  return (
    <Card>
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
              onClick={() => navigate(`/medlem/${primaryMember.id}`)}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
            >
              <div>
                <p className="font-medium">
                  {primaryMember.first_name} {primaryMember.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Kundnr: {primaryMember.fortnox_customer_number}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {primaryMember.relation_type === 'HOUSEHOLD' ? 'Hushåll' : primaryMember.relation_type}
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
                  onClick={() => navigate(`/medlem/${mb.id}`)}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                >
                  <div>
                    <p className="font-medium">
                      {mb.first_name} {mb.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Kundnr: {mb.fortnox_customer_number}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {mb.relation_type === 'HOUSEHOLD' ? 'Hushåll' : mb.relation_type}
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
  );
}
