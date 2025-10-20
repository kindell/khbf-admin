import { ChevronRight, Smartphone, CreditCard } from 'lucide-react';
import { Badge } from '../ui/badge';
import { type Member } from '../../lib/supabase';
import { getCategoryBadgeVariant, type MemberCategory } from '../../lib/member-categories';

interface MemberRowProps {
  member: Member & { category: MemberCategory };
  onClick: () => void;
  queuePosition?: number;
  displayCategory?: MemberCategory;
}

export function MemberRow({ member, onClick, queuePosition, displayCategory }: MemberRowProps) {
  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div
      onClick={onClick}
      className="
        bg-white border-b border-gray-200 last:border-b-0
        active:bg-gray-50 active:scale-[0.98]
        transition-all duration-100
        cursor-pointer
        min-h-[60px] flex items-center gap-3 px-4 py-3
      "
    >
      {/* Queue position badge (if applicable) */}
      {queuePosition !== undefined && (
        <div className="flex-shrink-0 w-8 text-center font-semibold text-gray-500 text-sm">
          #{queuePosition}
        </div>
      )}

      {/* Avatar with initials */}
      <div className="
        flex-shrink-0 w-10 h-10 rounded-full
        bg-gradient-to-br from-blue-500 to-blue-600
        flex items-center justify-center
        text-white font-semibold text-sm
      ">
        {getInitials(member.full_name || 'N/A')}
      </div>

      {/* Member info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-[15px] text-gray-900 truncate">
            {member.full_name}
          </span>
          <Badge
            variant={getCategoryBadgeVariant(displayCategory || member.category)}
            className="text-[11px] px-1.5 py-0 h-5"
          >
            {displayCategory || member.category}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-[13px] text-gray-500">
          <span className="font-mono">#{member.fortnox_customer_number}</span>

          {/* Access icons */}
          <div className="flex items-center gap-1.5">
            {member.parakey_user_id && (
              <Smartphone className="h-3.5 w-3.5" title="Parakey" />
            )}
            {member.aptus_user_id && (
              <CreditCard className="h-3.5 w-3.5" title="RFID" />
            )}
          </div>

          {/* Visits (only if not queue view) */}
          {queuePosition === undefined && member.visits_last_month !== undefined && (
            <span className="font-medium">
              {member.visits_last_month} besök
            </span>
          )}
        </div>
      </div>

      {/* Chevron indicator */}
      <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
    </div>
  );
}
