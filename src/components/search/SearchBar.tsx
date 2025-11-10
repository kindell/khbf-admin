import { useState, useEffect, useRef } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onClear: () => void;
  placeholder?: string;
}

export function SearchBar({ onSearch, onClear, placeholder = 'Search' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const debounceTimeoutRef = useRef<number | null>(null);

  // Debounced search - 150ms delay
  useEffect(() => {
    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      if (query.length >= 2) {
        onSearch(query);
      } else if (query.length === 0) {
        onClear();
      }
    }, 150);

    // Cleanup on unmount
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [query, onSearch, onClear]);

  const handleClear = () => {
    setQuery('');
    onClear();
  };

  return (
    <div className="search-container">
      <div className={`search-bar ${isFocused ? 'search-bar--focused' : ''}`}>
        <svg
          className="search-icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="6.5" cy="6.5" r="5" strokeWidth="1.5" />
          <path d="M10 10l4 4" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoComplete="off"
          spellCheck="false"
        />
        {query && (
          <button
            className="search-cancel"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path
                d="M1 1l10 10M11 1L1 11"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
