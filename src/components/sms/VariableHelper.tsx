import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { SMS_VARIABLES } from '../../lib/smsVariables';

interface VariableHelperProps {
  onInsertVariable?: (variable: string) => void;
}

export function VariableHelper({ onInsertVariable }: VariableHelperProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden bg-blue-50/50">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600" />
          <span className="font-medium text-sm text-blue-900">
            Personalisera med variabler
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-blue-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-blue-600" />
        )}
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="px-4 py-3 border-t border-blue-200/50 space-y-2">
          <p className="text-sm text-gray-600 mb-3">
            Klicka på en variabel för att lägga till den i meddelandet.
            Variablerna ersätts automatiskt med personlig information för varje mottagare.
          </p>

          <div className="space-y-2">
            {Object.entries(SMS_VARIABLES).map(([variable, description]) => (
              <button
                key={variable}
                onClick={() => onInsertVariable?.(variable)}
                className="w-full text-left px-3 py-2 rounded-md bg-white hover:bg-blue-100 transition-colors border border-blue-200/50 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <code className="text-sm font-mono text-blue-700 font-semibold">
                      {variable}
                    </code>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {description}
                    </p>
                  </div>
                  <span className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    Klicka för att infoga
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-xs text-yellow-800">
              <strong>Tips:</strong> Du kan också skriva variablerna direkt i meddelandet.
              Exempel: "Hej {`{{förnamn}}`}! Du har varit här {`{{besök_vecka}}`} gånger denna vecka."
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
