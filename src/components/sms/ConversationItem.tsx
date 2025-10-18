import { formatConversationTime } from '../../lib/timeFormatting';

interface Thread {
  id: string;
  phone_number: string;
  member_name: string | null;
  last_message_text: string;
  last_message_at: string;
  unread_count: number;
}

interface Broadcast {
  id: string;
  message: string;
  recipient_count: number;
  sent_at: string;
  name?: string | null;
}

interface ConversationItemProps {
  item: { type: 'thread'; data: Thread } | { type: 'broadcast'; data: Broadcast };
  onClick: () => void;
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// Generate avatar color based on phone number
function getAvatarColor(identifier: string): string {
  const colors = [
    'from-blue-400 to-blue-600',
    'from-green-400 to-green-600',
    'from-purple-400 to-purple-600',
    'from-pink-400 to-pink-600',
    'from-yellow-400 to-yellow-600',
    'from-red-400 to-red-600',
    'from-indigo-400 to-indigo-600',
    'from-teal-400 to-teal-600'
  ];

  // Hash string to number
  const hash = identifier.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function ConversationItem({ item, onClick }: ConversationItemProps) {
  // Extract data based on type
  const isBroadcast = item.type === 'broadcast';
  const data = item.data;

  // Get display values
  const broadcastData = data as Broadcast;
  const displayName = isBroadcast
    ? (broadcastData.name || `${broadcastData.recipient_count} mottagare`)
    : (data as Thread).member_name || (data as Thread).phone_number;

  const previewText = isBroadcast
    ? (data as Broadcast).message.substring(0, 80) + ((data as Broadcast).message.length > 80 ? '...' : '')
    : (data as Thread).last_message_text;

  const time = isBroadcast
    ? (data as Broadcast).sent_at
    : (data as Thread).last_message_at;

  const unreadCount = isBroadcast ? 0 : (data as Thread).unread_count;
  const hasUnread = unreadCount > 0;

  // Get initials/icon for avatar
  const avatarContent = isBroadcast
    ? '📢'
    : (data as Thread).member_name
        ? (data as Thread).member_name!
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        : (data as Thread).phone_number.slice(-2);

  const avatarColor = isBroadcast
    ? 'from-purple-400 to-indigo-600'
    : getAvatarColor((data as Thread).phone_number);

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        'hover:bg-gray-50 active:bg-gray-100',
        'cursor-pointer transition-colors duration-150',
        'border-b border-gray-200/50'
      )}
    >
      {/* Unread indicator dot (only shown if unread) */}
      <div className="w-2 flex-shrink-0">
        {hasUnread && (
          <div className="w-2 h-2 rounded-full bg-[#007AFF]" />
        )}
      </div>

      {/* Avatar */}
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          'text-white font-medium flex-shrink-0',
          'bg-gradient-to-br',
          isBroadcast ? 'text-lg' : 'text-sm',
          avatarColor
        )}
      >
        {avatarContent}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              'text-[17px] truncate',
              hasUnread ? 'font-semibold' : 'font-normal'
            )}
          >
            {displayName}
          </span>
          <span className="text-[15px] text-gray-500 flex-shrink-0">
            {formatConversationTime(time)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p
            className={cn(
              'text-[15px] truncate',
              hasUnread ? 'text-gray-900 font-medium' : 'text-gray-500'
            )}
          >
            {previewText}
          </p>

          {hasUnread && (
            <div className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[#007AFF] text-white text-xs font-medium flex items-center justify-center">
              {unreadCount}
            </div>
          )}
        </div>
      </div>

      {/* Chevron */}
      <svg
        className="w-5 h-5 text-gray-400 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}
