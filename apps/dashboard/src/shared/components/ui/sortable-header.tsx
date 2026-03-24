import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc' | null;

interface SortableHeaderProps {
  label: string;
  column: string;
  currentSort: string | null;
  currentDirection: SortDirection;
  onSort: (column: string, direction: SortDirection) => void;
  className?: string;
}

export function SortableHeader({
  label,
  column,
  currentSort,
  currentDirection,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = currentSort === column;

  const handleClick = () => {
    if (!isActive) {
      onSort(column, 'asc');
    } else if (currentDirection === 'asc') {
      onSort(column, 'desc');
    } else {
      onSort(column, null);
    }
  };

  const ariaSortValue = isActive
    ? currentDirection === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';

  return (
    <th
      className={`cursor-pointer select-none pb-3 pr-4 ${className ?? ''}`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      tabIndex={0}
      aria-sort={ariaSortValue}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && currentDirection === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : isActive && currentDirection === 'desc' ? (
          <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </span>
    </th>
  );
}
