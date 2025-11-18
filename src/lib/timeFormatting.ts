/**
 * Format timestamp for conversation list (Apple Messages style)
 * - Less than 1 hour: "5m", "30m"
 * - Today: "9:41"
 * - Yesterday: "Igår"
 * - This week: "Måndag", "Tisdag"
 * - Older: "15 jan", "3 dec"
 */
export function formatConversationTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Less than 1 minute: "Nu"
  if (diffMins < 1) {
    return 'Nu';
  }

  // Less than 1 hour: show minutes
  if (diffMins < 60) {
    return `${diffMins}m`;
  }

  // Today: show time (24-hour format for Swedish)
  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
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
    return 'Igår';
  }

  // This week: show day name
  if (diffDays < 7) {
    return date.toLocaleDateString('sv-SE', { weekday: 'long' });
  }

  // Older: show date
  return date.toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short'
  });
}

/**
 * Format timestamp for message bubbles (Apple Messages style)
 * Returns: "09:41"
 */
export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}
