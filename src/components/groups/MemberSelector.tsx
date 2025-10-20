import { useState, useEffect, useRef } from 'react';
import { Search, X, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { GroupMemberInfo } from '../../types/groups';
import { Card, CardContent } from '../ui/card';

interface MemberSelectorProps {
  selectedMembers: GroupMemberInfo[];
  onMembersChange: (members: GroupMemberInfo[]) => void;
}

export function MemberSelector({ selectedMembers, onMembersChange }: MemberSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GroupMemberInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const resultRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Search members when query changes
  useEffect(() => {
    const searchMembers = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      setShowResults(true);

      try {
        // Search by name or customer number
        // Split search query to handle "Jon Kindell" style searches
        const searchTerms = searchQuery.trim().split(/\s+/);

        let query = supabase
          .from('members')
          .select(`
            id,
            first_name,
            last_name,
            fortnox_customer_number,
            last_visit_at,
            visits_last_month
          `)
          .neq('is_system_account', true);

        // If multiple search terms (e.g., "Jon Kindell"), search both parts
        if (searchTerms.length > 1) {
          // Build an OR query that checks if both terms match either name field
          const orConditions = searchTerms.map(term =>
            `first_name.ilike.%${term}%,last_name.ilike.%${term}%`
          ).join(',');
          query = query.or(orConditions);
        } else {
          // Single term: search first_name, last_name, or customer number
          query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,fortnox_customer_number.ilike.%${searchQuery}%`);
        }

        const { data, error } = await query.limit(50);

        if (error) throw error;

        // Filter results client-side for multi-term searches to ensure all terms match
        let filteredData = data || [];
        if (searchTerms.length > 1) {
          filteredData = filteredData.filter(member => {
            const fullName = `${member.first_name} ${member.last_name}`.toLowerCase();
            const customerNumber = member.fortnox_customer_number.toLowerCase();
            const searchLower = searchQuery.toLowerCase();

            // Check if full name contains the search query
            return fullName.includes(searchLower) ||
                   customerNumber.includes(searchLower) ||
                   searchTerms.every(term =>
                     fullName.includes(term.toLowerCase()) ||
                     customerNumber.includes(term.toLowerCase())
                   );
          });
        }

        // Get phone numbers for these members
        const memberIds = filteredData.map(m => m.id);
        const { data: phoneData } = await supabase
          .from('phone_mappings')
          .select('member_id, phone_number')
          .in('member_id', memberIds)
          .eq('is_primary', true);

        // Create phone map
        const phoneMap = new Map<string, string>();
        phoneData?.forEach(p => {
          phoneMap.set(p.member_id, p.phone_number);
        });

        // Filter out already selected members
        const selectedIds = new Set(selectedMembers.map(m => m.member_id));
        const results: GroupMemberInfo[] = filteredData
          .filter(m => !selectedIds.has(m.id))
          .slice(0, 20) // Limit to top 20 results
          .map(m => ({
            member_id: m.id,
            first_name: m.first_name,
            last_name: m.last_name,
            phone_number: phoneMap.get(m.id) || '',
            fortnox_customer_number: m.fortnox_customer_number,
            last_visit_at: m.last_visit_at,
            visits_last_month: m.visits_last_month,
          }));

        setSearchResults(results);
      } catch (error) {
        console.error('Error searching members:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      searchMembers();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, selectedMembers]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultRefs.current[selectedIndex]) {
      resultRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  const handleAddMember = (member: GroupMemberInfo) => {
    onMembersChange([...selectedMembers, member]);
    setSearchQuery('');
    setShowResults(false);
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || searchResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (searchResults[selectedIndex]) {
          handleAddMember(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowResults(false);
        break;
    }
  };

  const handleRemoveMember = (memberId: string) => {
    onMembersChange(selectedMembers.filter(m => m.member_id !== memberId));
  };

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Sök medlem (namn eller kundnummer)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (searchResults.length > 0) {
                setShowResults(true);
              }
            }}
            className="
              w-full pl-10 pr-4 py-2
              border border-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500
              placeholder:text-gray-400
            "
          />
        </div>

        {/* Search results dropdown */}
        {showResults && searchResults.length > 0 && (
          <Card className="absolute z-10 w-full mt-1 max-h-80 overflow-y-auto shadow-lg">
            <CardContent className="p-0">
              {searchResults.map((member, index) => (
                <div
                  key={member.member_id}
                  ref={el => resultRefs.current[index] = el}
                  onClick={() => handleAddMember(member)}
                  className={`
                    flex items-center gap-3 px-4 py-3
                    border-b border-gray-100 last:border-b-0
                    cursor-pointer
                    transition-colors
                    ${index === selectedIndex
                      ? 'bg-blue-50 border-blue-200'
                      : 'hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <UserPlus className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900">
                      {member.first_name} {member.last_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {member.fortnox_customer_number}
                      {member.phone_number && ` • ${member.phone_number}`}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* No results message */}
        {showResults && searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
          <Card className="absolute z-10 w-full mt-1 shadow-lg">
            <CardContent className="p-4 text-center text-sm text-gray-600">
              Inga medlemmar matchar "{searchQuery}"
            </CardContent>
          </Card>
        )}
      </div>

      {/* Selected members - pills */}
      {selectedMembers.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Valda medlemmar ({selectedMembers.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {selectedMembers.map((member) => (
              <div
                key={member.member_id}
                className="
                  inline-flex items-center gap-2
                  bg-blue-50 border border-blue-200 rounded-full
                  px-3 py-1.5
                  text-sm text-blue-900
                "
              >
                <span className="font-medium">
                  {member.first_name} {member.last_name}
                </span>
                <button
                  onClick={() => handleRemoveMember(member.member_id)}
                  className="
                    flex-shrink-0
                    text-blue-600 hover:text-blue-800
                    transition-colors
                  "
                  aria-label={`Ta bort ${member.first_name} ${member.last_name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {selectedMembers.length === 0 && !searchQuery && (
        <div className="
          border-2 border-dashed border-gray-300 rounded-lg
          p-8 text-center
        ">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Search className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600 mb-1">
            Inga medlemmar valda
          </p>
          <p className="text-xs text-gray-500">
            Sök och lägg till medlemmar i gruppen
          </p>
        </div>
      )}
    </div>
  );
}
