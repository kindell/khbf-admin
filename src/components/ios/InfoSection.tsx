import { type ReactNode } from 'react';

interface InfoSectionProps {
  title?: string;
  children: ReactNode;
  footer?: string;
}

/**
 * iOS/iPad-style grouped section with rounded corners and shadow
 * Responsive: compact on mobile, wider with max-width on desktop
 */
export function InfoSection({ title, children, footer }: InfoSectionProps) {
  return (
    <div className="space-y-2">
      {/* Section title */}
      {title && (
        <h3 className="
          px-4 lg:px-0 text-[13px] font-semibold uppercase
          tracking-wide text-gray-500
        ">
          {title}
        </h3>
      )}

      {/* Grouped content with rounded corners */}
      <div className="
        bg-white
        rounded-xl
        overflow-hidden
        shadow-sm
        border border-gray-200
        lg:max-w-3xl
      ">
        {children}
      </div>

      {/* Footer note (optional) */}
      {footer && (
        <p className="px-4 lg:px-0 text-[13px] text-gray-500 leading-relaxed lg:max-w-3xl">
          {footer}
        </p>
      )}
    </div>
  );
}
