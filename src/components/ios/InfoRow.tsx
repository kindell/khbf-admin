import { ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';

interface InfoRowProps {
  label: string;
  value: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
}

/**
 * iOS-style info row with label on left, value on right
 * Optional chevron for navigable rows
 */
export function InfoRow({ label, value, onClick, icon }: InfoRowProps) {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-3
        px-4 py-3
        bg-white border-b border-gray-200 last:border-b-0
        ${isClickable ? 'active:bg-gray-50 cursor-pointer' : ''}
        transition-colors
        min-h-[44px]
      `}
    >
      {/* Icon (optional) */}
      {icon && (
        <div className="flex-shrink-0 w-7 text-gray-500">
          {icon}
        </div>
      )}

      {/* Label */}
      <div className="flex-shrink-0 text-[15px] text-gray-900 min-w-[100px]">
        {label}
      </div>

      {/* Value */}
      <div className="flex-1 text-right text-[15px] text-gray-500 truncate">
        {value}
      </div>

      {/* Chevron (if clickable) */}
      {isClickable && (
        <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
      )}
    </div>
  );
}
