export interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  message: string;
  created_at: string;
  status?: 'pending' | 'sent' | 'delivered' | 'failed';
  [key: string]: any;
}

export interface GroupedMessage extends Message {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  showTimestampOnLoad: boolean;
}

/**
 * Groups messages according to Apple Messages style:
 * - Messages within 2 minutes from same direction are grouped
 * - First message in each group shows timestamp
 * - Border radius adjusts based on position in group
 */
export function groupMessages(messages: Message[]): GroupedMessage[] {
  if (messages.length === 0) return [];

  const grouped: GroupedMessage[] = [];
  const TIME_THRESHOLD = 2 * 60 * 1000; // 2 minutes in milliseconds

  messages.forEach((msg, index) => {
    const prevMsg = messages[index - 1];
    const nextMsg = messages[index + 1];

    // Determine if this is the start of a new group
    const isFirstInGroup =
      index === 0 ||
      prevMsg.direction !== msg.direction ||
      new Date(msg.created_at).getTime() -
        new Date(prevMsg.created_at).getTime() >
        TIME_THRESHOLD;

    // Determine if this is the end of a group
    const isLastInGroup =
      index === messages.length - 1 ||
      nextMsg.direction !== msg.direction ||
      new Date(nextMsg.created_at).getTime() -
        new Date(msg.created_at).getTime() >
        TIME_THRESHOLD;

    // Show timestamp on first message of each group
    const showTimestampOnLoad = isFirstInGroup;

    grouped.push({
      ...msg,
      isFirstInGroup,
      isLastInGroup,
      showTimestampOnLoad
    });
  });

  return grouped;
}
