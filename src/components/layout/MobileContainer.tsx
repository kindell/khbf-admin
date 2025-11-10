import { type ReactNode } from 'react';
import { usePageTransition } from '../../hooks/usePageTransition';
import './PageTransition.css';

interface MobileContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Responsive container that handles mobile/desktop layout differences
 * - Mobile: Full screen (inset-0) with iOS-style page transitions
 * - Desktop: Offset by sidebar width (lg:left-64)
 */
export function MobileContainer({ children, className = '' }: MobileContainerProps) {
  const animationClass = usePageTransition();

  return (
    <div className={`
      fixed inset-0
      lg:left-64
      flex flex-col
      bg-gray-50
      ${animationClass}
      ${className}
    `}>
      {children}
    </div>
  );
}
