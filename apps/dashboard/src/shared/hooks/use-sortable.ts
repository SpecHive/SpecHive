import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';

import type { SortDirection } from '@/shared/components/ui/sortable-header';

interface UseSortableOptions {
  syncWithUrl?: boolean;
  defaultColumn?: string | null;
  defaultDirection?: SortDirection;
  onSortChange?: () => void;
}

interface UseSortableResult {
  sortBy: string | null;
  sortDirection: SortDirection;
  handleSort: (column: string, direction: SortDirection) => void;
}

export function useSortable(options: UseSortableOptions = {}): UseSortableResult {
  const {
    syncWithUrl = false,
    defaultColumn = null,
    defaultDirection = null,
    onSortChange,
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();

  const [localSortBy, setLocalSortBy] = useState<string | null>(defaultColumn);
  const [localSortDirection, setLocalSortDirection] = useState<SortDirection>(defaultDirection);

  const sortBy = syncWithUrl ? searchParams.get('sortBy') || null : localSortBy;

  const sortDirection = syncWithUrl
    ? (searchParams.get('sortOrder') as SortDirection) || null
    : localSortDirection;

  const handleSort = useCallback(
    (column: string, direction: SortDirection) => {
      if (syncWithUrl) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (direction) {
            next.set('sortBy', column);
            next.set('sortOrder', direction);
          } else {
            next.delete('sortBy');
            next.delete('sortOrder');
          }
          next.delete('page');
          return next;
        });
      } else {
        setLocalSortBy(direction ? column : null);
        setLocalSortDirection(direction);
      }
      onSortChange?.();
    },
    [syncWithUrl, setSearchParams, onSortChange],
  );

  return { sortBy, sortDirection, handleSort };
}
