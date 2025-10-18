/**
 * Format timestamp for conversation list (Apple Messages style)
 * - Less than 1 hour: "5m", "30m"
 * - Today: "9:41 AM"
 * - Yesterday: "Yesterday"
 * - This week: "Monday", "Tuesday"
 * - Older: "Jan 15", "Dec 3"
 */
export function formatConversationTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Less than 1 minute: "Now"
  if (diffMins < 1) {
    return 'Now';
  }

  // Less than 1 hour: show minutes
  if (diffMins < 60) {
    return `${diffMins}m`;
  }

  // Today: show time
  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Yesterday';
  }

  // This week: show day name
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  // Older: show date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format timestamp for message bubbles (Apple Messages style)
 * Returns: "9:41 AM"
 */
export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}
