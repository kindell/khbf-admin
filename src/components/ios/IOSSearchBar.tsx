import { Search, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface IOSSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * iOS-style search bar with cancel button
 */
export function IOSSearchBar({ value, onChange, placeholder = "Sök..." }: IOSSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCancel = () => {
    onChange('');
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      {/* Search input container */}
      <div className={`
        flex-1 relative
        transition-all duration-200
        ${isFocused ? 'flex-1' : 'flex-1'}
      `}>
        {/* Search icon */}
        <Search className="
          absolute left-3 top-1/2 -translate-y-1/2
          h-4 w-4 text-gray-400
          pointer-events-none
        " />

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="
            w-full
            pl-9 pr-9
            py-2
            bg-gray-100
            border-none
            rounded-lg
            text-[15px]
            placeholder:text-gray-400
            focus:outline-none
            focus:ring-2 focus:ring-blue-500
            transition-all
          "
        />

        {/* Clear button */}
        {value && (
          <button
            onClick={handleClear}
            className="
              absolute right-3 top-1/2 -translate-y-1/2
              w-5 h-5
              rounded-full
              bg-gray-400
              flex items-center justify-center
              hover:bg-gray-500
              transition-colors
            "
            aria-label="Rensa"
          >
            <X className="h-3 w-3 text-white" />
          </button>
        )}
      </div>

      {/* Cancel button (only visible when focused or has value) */}
      {(isFocused || value) && (
        <button
          onClick={handleCancel}
          className="
            text-blue-500 text-[15px] font-normal
            px-2
            hover:opacity-70
            active:opacity-40
            transition-opacity
            whitespace-nowrap
          "
        >
          Avbryt
        </button>
      )}
    </div>
  );
}
