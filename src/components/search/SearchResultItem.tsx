import { formatConversationTime } from '../../lib/timeFormatting';

interface SearchResultItemProps {
  result: {
    messageId: string;
    messageText: string;
    createdAt: string;
    conversationId: string;
    contactName: string | null;
    phoneNumber: string;
  };
  query: string;
  onClick: () => void;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;

  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={index}>{part}</mark>
    ) : (
      part
    )
  );
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Generate avatar color based on phone number (same as ConversationItem)
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

  const hash = identifier.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function SearchResultItem({ result, query, onClick }: SearchResultItemProps) {
  const initials = result.contactName
    ? result.contactName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : result.phoneNumber.slice(-2);

  return (
    <div className="search-result-item" onClick={onClick}>
      {/* Avatar */}
      <div
        className={`search-result-avatar bg-gradient-to-br ${getAvatarColor(
          result.phoneNumber
        )}`}
      >
        {initials}
      </div>

      {/* Content */}
      <div className="search-result-content">
        <div className="search-result-header">
          <span className="search-result-name">
            {result.contactName || result.phoneNumber}
          </span>
          <span className="search-result-time">
            {formatConversationTime(result.createdAt)}
          </span>
        </div>
        <div className="search-result-message">
          {highlightText(result.messageText, query)}
        </div>
      </div>
    </div>
  );
}
