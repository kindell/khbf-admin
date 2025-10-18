interface ThreadHeaderProps {
  contactName: string;
  phoneNumber: string;
  subtitle?: string;
  onBack: () => void;
  onMenu: () => void;
  onInfo?: () => void;
}

export function ThreadHeader({
  contactName,
  phoneNumber,
  subtitle,
  onBack,
  onMenu,
  onInfo
}: ThreadHeaderProps) {
  return (
    <div className="z-10 h-auto py-3 px-4 pb-4 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-black/10 w-full box-border flex-shrink-0">
      {/* Left side: Menu + Back buttons */}
      <div className="flex items-center gap-1">
        {/* Menu button - primary action (hidden on desktop) */}
        <button
          className="p-2 -ml-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors lg:invisible"
          onClick={onMenu}
          aria-label="Öppna meny"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-gray-700">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Back button - secondary action, icon only on mobile */}
        <button
          className="flex items-center gap-1 p-2 text-blue-500 text-[15px] hover:opacity-70 active:opacity-40 transition-opacity"
          onClick={onBack}
          aria-label="Tillbaka till meddelanden"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path
              d="M12 16l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="hidden xs:inline">Tillbaka</span>
        </button>
      </div>

      {/* Center info - reduced max-width to accommodate dual buttons */}
      <div className="absolute left-1/2 -translate-x-1/2 text-center max-w-[45%]">
        <div className="text-[17px] font-semibold text-black whitespace-nowrap overflow-hidden text-ellipsis">
          {contactName || phoneNumber}
        </div>
        {subtitle && (
          <div className="text-xs text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">
            {subtitle}
          </div>
        )}
      </div>

      {/* Info button */}
      {onInfo && (
        <button
          className="w-8 h-8 rounded-full bg-transparent border-none text-blue-500 flex items-center justify-center cursor-pointer hover:bg-blue-500/10 active:bg-blue-500/20 transition-colors"
          onClick={onInfo}
          aria-label="Conversation info"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle
              cx="10"
              cy="10"
              r="8"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M10 7v0M10 10v4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
