interface SectionHeaderProps {
  title: string;
  count?: number;
}

/**
 * iOS-style section header with uppercase gray text
 */
export function SectionHeader({ title, count }: SectionHeaderProps) {
  return (
    <div className="
      px-4 py-2
      bg-gray-50
      sticky top-14 lg:top-0
      z-10
    ">
      <h3 className="
        text-[13px] font-semibold uppercase
        tracking-wide
        text-gray-500
      ">
        {title}
        {count !== undefined && ` (${count})`}
      </h3>
    </div>
  );
}
