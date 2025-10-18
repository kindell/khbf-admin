import { useState } from 'react';

interface MessageBubbleProps {
  message: string;
  direction: 'inbound' | 'outbound';
  timestamp: string;
  status?: 'pending' | 'sent' | 'delivered' | 'failed';
  isGrouped?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  showTimestampOnLoad?: boolean;
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function MessageBubble({
  message,
  direction,
  timestamp,
  status,
  isFirstInGroup = true,
  isLastInGroup = true,
  showTimestampOnLoad = false
}: MessageBubbleProps) {
  const [showTimestamp, setShowTimestamp] = useState(showTimestampOnLoad);

  // Determine border radius based on grouping and direction
  let borderRadiusClass = '';

  if (isFirstInGroup && isLastInGroup) {
    // Single message, full radius
    borderRadiusClass = 'rounded-[18px]';
  } else if (isFirstInGroup && !isLastInGroup) {
    // First in group
    if (direction === 'outbound') {
      borderRadiusClass = 'rounded-t-[18px] rounded-bl-[18px] rounded-br-[4px]';
    } else {
      borderRadiusClass = 'rounded-t-[18px] rounded-br-[18px] rounded-bl-[4px]';
    }
  } else if (!isFirstInGroup && isLastInGroup) {
    // Last in group
    if (direction === 'outbound') {
      borderRadiusClass = 'rounded-b-[18px] rounded-tl-[18px] rounded-tr-[4px]';
    } else {
      borderRadiusClass = 'rounded-b-[18px] rounded-tr-[18px] rounded-tl-[4px]';
    }
  } else {
    // Middle of group
    if (direction === 'outbound') {
      borderRadiusClass = 'rounded-l-[18px] rounded-tr-[4px] rounded-br-[4px]';
    } else {
      borderRadiusClass = 'rounded-r-[18px] rounded-tl-[4px] rounded-bl-[4px]';
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        direction === 'outbound' ? 'items-end' : 'items-start'
      )}
    >
      {/* Timestamp (shown on click) */}
      {showTimestamp && (
        <div className="text-xs text-gray-500 px-4">
          {formatTime(timestamp)}
        </div>
      )}

      {/* Bubble */}
      <div
        onClick={() => setShowTimestamp(!showTimestamp)}
        className={cn(
          "px-4 py-2.5 max-w-[70%] break-words cursor-pointer",
          "transition-all duration-200 ease-out",
          borderRadiusClass,

          // Outbound (blue iMessage style)
          direction === 'outbound' && "bg-[#007AFF] text-white",
          direction === 'outbound' && "ml-auto",
          direction === 'outbound' && "shadow-sm shadow-black/10",

          // Inbound (gray)
          direction === 'inbound' && "bg-[#E5E5EA] text-black",
          direction === 'inbound' && "mr-auto"
        )}
      >
        <p className="text-[17px] leading-[22px] tracking-[-0.4px] whitespace-pre-wrap">
          {message}
        </p>
      </div>

      {/* Status (only for outbound, only last in group) */}
      {direction === 'outbound' && isLastInGroup && status && (
        <div className="text-xs text-gray-500 px-4 mt-0.5">
          {status === 'pending' && 'Sending...'}
          {status === 'sent' && 'Sent'}
          {status === 'delivered' && 'Delivered'}
          {status === 'failed' && (
            <span className="text-red-500">Not Delivered</span>
          )}
        </div>
      )}
    </div>
  );
}
