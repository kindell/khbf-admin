import { useState, useEffect, useRef } from 'react';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Meddelande'
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to get correct scrollHeight
      textareaRef.current.style.height = 'auto';
      // Set height to scrollHeight (content height)
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120); // Max 120px
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (!message.trim() || disabled) return;
    onSend(message.trim());
    setMessage('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = message.trim().length > 0 && !disabled;

  return (
    <div className="bg-white border-t min-h-[72px] p-4 w-full box-border z-10 flex-shrink-0">
      <div className="flex items-end gap-2 max-w-full box-border w-full">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none py-2 px-3 border border-gray-300 rounded-[20px] text-[17px] leading-[22px] text-black bg-white outline-none min-h-[36px] max-h-[120px] overflow-y-auto transition-colors focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed placeholder:text-gray-500"
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`w-9 h-9 min-w-[36px] min-h-[36px] rounded-full border-none flex items-center justify-center cursor-pointer transition-all flex-shrink-0 ${
            canSend
              ? 'bg-blue-500 text-white hover:bg-blue-600 hover:scale-105 active:bg-blue-700 active:scale-95'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
          aria-label="Send message"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 2l8 8-8 8V2z" transform="rotate(-90 10 10)" />
          </svg>
        </button>
      </div>
    </div>
  );
}
