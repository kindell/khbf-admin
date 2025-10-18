import { Menu } from 'lucide-react';

interface MobileHeaderProps {
  title: string;
  onMenuClick: () => void;
}

/**
 * Mobile header with hamburger menu and page title
 * Only visible on mobile (< lg breakpoint)
 * Hidden if title is empty (for pages with their own headers)
 */
export function MobileHeader({ title, onMenuClick }: MobileHeaderProps) {
  // Don't render if no title (pages like messages have their own headers)
  if (!title) return null;

  return (
    <header className="lg:hidden sticky top-0 z-10 bg-white border-b border-gray-200 flex items-center h-14 px-4">
      <button
        onClick={onMenuClick}
        className="p-2 -ml-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors"
        aria-label="Öppna meny"
      >
        <Menu className="h-6 w-6" />
      </button>

      <h1 className="flex-1 text-center text-lg font-semibold text-gray-900 pr-10">
        {title}
      </h1>
    </header>
  );
}
