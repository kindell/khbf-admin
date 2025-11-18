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

// Generate consistent avatar style (matching ChatBubble)
function getAvatarStyle(identifier: string): { bg: string; text: string } {
  // Use consistent style: light background with colored text
  return {
    bg: 'bg-primary/10',
    text: 'text-primary'
  };
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

  const avatarStyle = isBroadcast
    ? { bg: 'bg-accent/10', text: 'text-accent' }
    : getAvatarStyle((data as Thread).phone_number);

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        'hover:bg-accent/50 active:bg-accent',
        'cursor-pointer transition-colors duration-150',
        'border-b border-border'
      )}
    >
      {/* Unread indicator dot (only shown if unread) */}
      <div className="w-2 flex-shrink-0">
        {hasUnread && (
          <div className="w-2 h-2 rounded-full bg-primary" />
        )}
      </div>

      {/* Avatar */}
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          'font-semibold flex-shrink-0',
          isBroadcast ? 'text-lg' : 'text-xs',
          avatarStyle.bg,
          avatarStyle.text
        )}
      >
        {avatarContent}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              'text-[17px] truncate text-foreground',
              hasUnread ? 'font-semibold' : 'font-normal'
            )}
          >
            {displayName}
          </span>
          <span className="text-[15px] text-muted-foreground flex-shrink-0">
            {formatConversationTime(time)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p
            className={cn(
              'text-[15px] truncate',
              hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground'
            )}
          >
            {previewText}
          </p>

          {hasUnread && (
            <div className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
              {unreadCount}
            </div>
          )}
        </div>
      </div>

      {/* Chevron */}
      <svg
        className="w-5 h-5 text-muted-foreground flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}
