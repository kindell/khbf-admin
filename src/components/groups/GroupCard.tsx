import { ChevronRight } from 'lucide-react';
import type { Group } from '../../types/groups';
import { Badge } from '../ui/badge';

interface GroupCardProps {
  group: Group;
  onClick: () => void;
}

export function GroupCard({ group, onClick }: GroupCardProps) {
  const formatLastActivity = (date?: string | null) => {
    if (!date) return 'Aldrig skickat';

    const now = new Date();
    const activityDate = new Date(date);
    const diffMs = now.getTime() - activityDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Idag';
    if (diffDays === 1) return 'Igår';
    if (diffDays < 7) return `För ${diffDays} dagar sedan`;
    if (diffDays < 30) return `För ${Math.floor(diffDays / 7)} veckor sedan`;
    return `För ${Math.floor(diffDays / 30)} månader sedan`;
  };

  const formatLastUpdate = (date?: string | null) => {
    if (!date) return '';

    const now = new Date();
    const updateDate = new Date(date);
    const diffMs = now.getTime() - updateDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return 'Nyss';
    if (diffMinutes < 60) return `${diffMinutes} min sedan`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} tim sedan`;
    return formatLastActivity(date);
  };

  return (
    <div
      onClick={onClick}
      className="
        bg-white border-b border-gray-200 last:border-b-0
        active:bg-gray-50 active:scale-[0.98]
        transition-all duration-100
        cursor-pointer
        min-h-[70px] flex items-center gap-3 px-4 py-3
      "
    >
      {/* Icon badge - different for static vs dynamic */}
      <div
        className={`
          flex-shrink-0 w-10 h-10 rounded-full
          flex items-center justify-center text-xl
          ${group.type === 'static'
            ? 'bg-blue-100 text-blue-600'
            : 'bg-purple-100 text-purple-600'
          }
        `}
      >
        {group.type === 'static' ? '👥' : '⚡'}
      </div>

      {/* Group info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-[15px] text-gray-900 truncate">
            {group.name}
          </span>
          {group.ai_created && (
            <Badge
              variant="secondary"
              className="text-[11px] px-1.5 py-0 h-5 flex-shrink-0 bg-green-100 text-green-700 border-green-200"
              title={group.ai_query || 'AI-skapad grupp'}
            >
              🤖 AI
            </Badge>
          )}
          <Badge
            variant="outline"
            className="text-[11px] px-1.5 py-0 h-5 flex-shrink-0"
          >
            {group.member_count || 0} {group.member_count === 1 ? 'medlem' : 'medlemmar'}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-[13px] text-gray-500">
          {group.type === 'dynamic' ? (
            <>
              <span>Uppdateras automatiskt</span>
              {group.last_count_update && (
                <>
                  <span>•</span>
                  <span>{formatLastUpdate(group.last_count_update)}</span>
                </>
              )}
            </>
          ) : (
            <span>{formatLastActivity(group.updated_at)}</span>
          )}
        </div>
      </div>

      {/* Chevron indicator */}
      <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
    </div>
  );
}
