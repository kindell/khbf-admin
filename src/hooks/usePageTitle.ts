import { useLocation } from 'react-router-dom';

/**
 * Hook that returns the page title based on current route
 */
export function usePageTitle(): string {
  const location = useLocation();

  if (location.pathname === '/') {
    return 'Medlemmar';
  }

  if (location.pathname.startsWith('/medlem/')) {
    // Don't show title for member detail pages - they have their own iOS headers
    return '';
  }

  if (location.pathname === '/parakey-mapping') {
    return 'Parakey Mapping';
  }

  if (location.pathname === '/visits') {
    return 'Besök';
  }

  if (location.pathname === '/settings') {
    return 'Inställningar';
  }

  if (location.pathname.startsWith('/messages')) {
    // Don't show title for message pages - they have their own headers
    return '';
  }

  return 'KHBF Admin';
}
