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
  reactionEmoji?: string | null;
  isAI?: boolean;
  messageId?: string;
  aiProcessed?: boolean;
  onRetryAI?: (messageId: string) => void;
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export function MessageBubble({
  message,
  direction,
  timestamp,
  status,
  isFirstInGroup = true,
  isLastInGroup = true,
  showTimestampOnLoad = false,
  reactionEmoji = null,
  isAI = false,
  messageId,
  aiProcessed = false,
  onRetryAI
}: MessageBubbleProps) {
  const [showTimestamp, setShowTimestamp] = useState(showTimestampOnLoad);
  const [isHovered, setIsHovered] = useState(false);

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Timestamp (shown on click) */}
      {showTimestamp && (
        <div className="text-xs text-gray-500 px-4">
          {formatTime(timestamp)}
        </div>
      )}

      {/* Bubble */}
      <div className="relative">
        <div
          onClick={() => setShowTimestamp(!showTimestamp)}
          className={cn(
            "px-4 py-2.5 max-w-[65%] break-words cursor-pointer",
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

        {/* Reaction Emoji Badge */}
        {reactionEmoji && (
          <div
            className={cn(
              "absolute -bottom-1.5 flex items-center justify-center",
              "bg-white rounded-full",
              "border-2 border-gray-100",
              "shadow-md",
              "w-7 h-7",
              "text-base",
              direction === 'outbound' ? "-right-1.5" : "-left-1.5"
            )}
          >
            {reactionEmoji}
          </div>
        )}
      </div>

      {/* Status and AI indicator (only for outbound, only last in group) */}
      {direction === 'outbound' && isLastInGroup && (status || isAI) && (
        <div className="text-xs text-gray-500 px-4 mt-0.5 flex items-center gap-2">
          {status && (
            <>
              {status === 'pending' && 'Sending...'}
              {status === 'sent' && 'Sent'}
              {status === 'delivered' && 'Delivered'}
              {status === 'failed' && (
                <span className="text-red-500">Not Delivered</span>
              )}
            </>
          )}
          {isAI && <span className="opacity-60">🤖 AI</span>}
        </div>
      )}

      {/* Retry AI button (only for inbound messages that have been AI processed) */}
      {direction === 'inbound' && aiProcessed && isLastInGroup && messageId && onRetryAI && isHovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRetryAI(messageId);
          }}
          className="text-xs text-blue-600 hover:text-blue-800 px-4 mt-1 flex items-center gap-1 transition-colors"
        >
          <span>🔄</span>
          <span>Skicka nytt AI-svar</span>
        </button>
      )}
    </div>
  );
}
