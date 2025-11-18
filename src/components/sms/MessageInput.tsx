import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Send, Info } from 'lucide-react';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showVariablesButton?: boolean;
  onShowVariables?: () => void;
}

export interface MessageInputRef {
  insertText: (text: string) => void;
  getText: () => string;
}

export const MessageInput = forwardRef<MessageInputRef, MessageInputProps>(({
  onSend,
  disabled = false,
  placeholder = 'Meddelande',
  showVariablesButton = false,
  onShowVariables
}, ref) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = message;

      // Insert text at cursor position
      const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
      setMessage(newValue);

      // Set cursor position after inserted text
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      }, 0);
    },
    getText: () => message
  }), [message]);

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
    <div className="bg-card border-t border-border/30 min-h-[72px] p-4 w-full box-border z-10 flex-shrink-0">
      <div className="flex items-end gap-2 max-w-full box-border w-full">
        {/* Variables button */}
        {showVariablesButton && (
          <button
            type="button"
            onClick={onShowVariables}
            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full border border-border/30 bg-muted text-muted-foreground hover:bg-accent flex items-center justify-center transition-all flex-shrink-0"
            aria-label="Visa variabler"
          >
            <Info className="w-4 h-4" />
          </button>
        )}

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none py-2 px-3 border border-border/30 rounded-[20px] text-[17px] leading-[22px] text-foreground bg-card outline-none min-h-[36px] max-h-[120px] overflow-y-auto transition-colors focus:border-primary disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed placeholder:text-muted-foreground"
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`w-9 h-9 min-w-[36px] min-h-[36px] rounded-full border-none flex items-center justify-center transition-all flex-shrink-0 bg-blue-500 text-white ${
            canSend
              ? 'cursor-pointer hover:bg-blue-600 hover:scale-105 active:bg-blue-700 active:scale-95'
              : 'opacity-40 cursor-not-allowed'
          }`}
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});
