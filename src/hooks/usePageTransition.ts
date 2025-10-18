import { useEffect, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export function usePageTransition() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [animationClass, setAnimationClass] = useState('');

  useEffect(() => {
    // Only animate on mobile
    if (window.innerWidth >= 1024) {
      setAnimationClass('');
      return;
    }

    // Check if location state specifies animation direction
    const state = location.state as { animationDirection?: 'forward' | 'back' } | null;

    // Don't animate when navigating directly to inbox from sidebar
    const isInbox = location.pathname === '/messages';
    const hasNoAnimationDirection = !state?.animationDirection;

    if (isInbox && hasNoAnimationDirection && navigationType === 'PUSH') {
      // Direct navigation to inbox (e.g., from sidebar) - no animation
      setAnimationClass('');
      return;
    }

    if (state?.animationDirection === 'back') {
      // Explicit back navigation - slide out to right
      setAnimationClass('page-slide-out-right');
    } else if (state?.animationDirection === 'forward') {
      // Explicit forward navigation - slide in from right
      setAnimationClass('page-slide-in-right');
    } else if (navigationType === 'POP') {
      // Browser back button - slide out to right
      setAnimationClass('page-slide-out-right');
    }

    // Clear animation after it completes
    const timer = setTimeout(() => {
      setAnimationClass('');
    }, 350);

    return () => clearTimeout(timer);
  }, [location.pathname, navigationType, location.state]);

  return animationClass;
}
