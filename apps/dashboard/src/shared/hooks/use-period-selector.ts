import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';

interface UsePeriodSelectorOptions {
  options: readonly number[];
  defaultDays?: number;
  syncWithUrl?: boolean;
}

interface UsePeriodSelectorResult {
  days: number;
  setDays: (days: number) => void;
  options: readonly number[];
}

export function usePeriodSelector({
  options,
  defaultDays,
  syncWithUrl = false,
}: UsePeriodSelectorOptions): UsePeriodSelectorResult {
  const fallback = defaultDays ?? options[options.length - 1];
  const [searchParams, setSearchParams] = useSearchParams();
  const [localDays, setLocalDays] = useState<number>(fallback);

  const days = syncWithUrl ? Number(searchParams.get('days')) || fallback : localDays;

  const setDays = useCallback(
    (d: number) => {
      if (syncWithUrl) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('days', String(d));
          next.delete('page');
          return next;
        });
      } else {
        setLocalDays(d);
      }
    },
    [syncWithUrl, setSearchParams],
  );

  return { days, setDays, options: [...options] };
}
