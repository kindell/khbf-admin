import { Menu } from 'lucide-react';

interface FloatingMenuButtonProps {
  onClick: () => void;
}

/**
 * Floating hamburger menu button
 * Only visible on mobile when no header is present
 */
export function FloatingMenuButton({ onClick }: FloatingMenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden fixed bottom-4 left-4 z-[250] p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 active:bg-gray-100 transition-colors border border-gray-200"
      aria-label="Öppna meny"
    >
      <Menu className="h-6 w-6 text-gray-700" />
    </button>
  );
}
