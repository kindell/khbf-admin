import { SearchResultItem } from './SearchResultItem';
import './SearchResults.css';

interface SearchResult {
  messageId: string;
  messageText: string;
  createdAt: string;
  conversationId: string;
  contactName: string | null;
  phoneNumber: string;
}

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  onResultClick: (result: SearchResult) => void;
}

export function SearchResults({ results, query, onResultClick }: SearchResultsProps) {
  if (!query || query.length < 2) {
    return (
      <div className="search-empty">
        <svg
          className="search-empty-icon"
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="20" cy="20" r="14" strokeWidth="3" />
          <path d="M30 30l12 12" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <p>Search messages, contacts, and more</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="search-no-results">
        <p>No Results</p>
        <p className="search-hint">Check the spelling or try a new search</p>
      </div>
    );
  }

  // Group results by conversation
  const groupedResults = results.reduce<
    Record<
      string,
      {
        conversation: { name: string; phoneNumber: string };
        messages: SearchResult[];
      }
    >
  >((acc, result) => {
    const key = result.conversationId;
    if (!acc[key]) {
      acc[key] = {
        conversation: {
          name: result.contactName || result.phoneNumber,
          phoneNumber: result.phoneNumber
        },
        messages: []
      };
    }
    acc[key].messages.push(result);
    return acc;
  }, {});

  return (
    <div className="search-results">
      {Object.entries(groupedResults).map(([conversationId, group]) => (
        <div key={conversationId} className="search-result-group">
          <div className="search-result-group-header">
            {group.messages.length} result{group.messages.length !== 1 ? 's' : ''} in{' '}
            {group.conversation.name}
          </div>
          {group.messages.map((result) => (
            <SearchResultItem
              key={result.messageId}
              result={result}
              query={query}
              onClick={() => onResultClick(result)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
