import { Bot, User as UserIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

interface ChatBubbleProps {
  message: string;
  direction: 'inbound' | 'outbound';
  timestamp: string;
  isAI?: boolean;
  status?: 'pending' | 'sent' | 'delivered' | 'failed';
  reactionEmoji?: string | null;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  showTimestampOnLoad?: boolean;
  userInitials?: string;  // Initials for the user (inbound messages)
  botInitials?: string;   // Initials for the bot/agent (outbound messages)
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// Function to render text with clickable links
function renderMessageWithLinks(text: string) {
  // Regex to match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    // If this part matches a URL, render as link
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-70 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    // Otherwise render as plain text
    return part;
  });
}

export function ChatBubble({
  message,
  direction,
  timestamp,
  status,
  reactionEmoji,
  isFirstInGroup = true,
  isLastInGroup = true,
  showTimestampOnLoad = true,
  userInitials,
  botInitials
}: ChatBubbleProps) {
  return (
    <div
      className={cn(
        "flex gap-3",
        direction === 'inbound' ? 'flex-row' : 'flex-row-reverse',
        !isLastInGroup && 'mb-1',
        isLastInGroup && 'mb-4'
      )}
    >
      {/* Avatar - only show on first message in group */}
      {isFirstInGroup ? (
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          direction === 'inbound'
            ? 'bg-primary/10 text-primary'
            : 'bg-accent/10 text-accent'
        )}>
          {direction === 'inbound' ? (
            userInitials ? (
              <span className="text-xs font-semibold">{userInitials}</span>
            ) : (
              <UserIcon className="w-5 h-5" />
            )
          ) : (
            botInitials ? (
              <span className="text-xs font-semibold">{botInitials}</span>
            ) : (
              <Bot className="w-5 h-5" />
            )
          )}
        </div>
      ) : (
        <div className="w-8 flex-shrink-0" />
      )}

      {/* Message Bubble */}
      <div className={cn(
        "flex-1 max-w-[80%]",
        direction === 'outbound' ? 'text-right' : ''
      )}>
        {/* Timestamp - only show on first message in group or if explicitly requested */}
        {(isFirstInGroup || showTimestampOnLoad) && (
          <p className={cn(
            "text-xs text-muted-foreground mb-1",
            direction === 'outbound' ? 'text-right' : 'text-left'
          )}>
            {formatDistanceToNow(new Date(timestamp), {
              addSuffix: true,
              locale: sv
            })}
          </p>
        )}

        <div className="relative inline-block">
          <div
            className={cn(
              "inline-block rounded-lg px-4 py-2",
              direction === 'inbound'
                ? 'bg-primary/10 text-primary'
                : 'bg-accent/10 text-accent'
            )}
          >
            <p className="whitespace-pre-wrap">{renderMessageWithLinks(message)}</p>
          </div>

          {/* Reaction Emoji Badge */}
          {reactionEmoji && (
            <div
              className={cn(
                "absolute -bottom-1.5 flex items-center justify-center",
                "bg-card rounded-full",
                "border-2 border-border",
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

        {/* Status - only show on last message in group */}
        {isLastInGroup && status && direction === 'outbound' && (
          <p className={cn(
            "text-xs text-muted-foreground mt-1",
            direction === 'outbound' ? 'text-right' : 'text-left'
          )}>
            {status === 'pending' && 'Skickar...'}
            {status === 'sent' && 'Skickat'}
            {status === 'delivered' && 'Levererat'}
            {status === 'failed' && <span className="text-destructive">Misslyckades</span>}
          </p>
        )}
      </div>
    </div>
  );
}
