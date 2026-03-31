import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

export function useDebouncedParam(key: string, delay = 300) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlValue = searchParams.get(key) || '';
  const [localValue, setLocalValue] = useState(urlValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isDebouncing = useRef(false);

  // Sync external URL changes (e.g., browser back/forward) → local state
  useEffect(() => {
    if (!isDebouncing.current) {
      setLocalValue(urlValue);
    }
  }, [urlValue]);

  // Push local changes → URL (debounced)
  useEffect(() => {
    if (localValue === urlValue) return;
    isDebouncing.current = true;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      isDebouncing.current = false;
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (localValue) {
          next.set(key, localValue);
        } else {
          next.delete(key);
        }
        next.delete('page');
        return next;
      });
    }, delay);
    return () => clearTimeout(debounceRef.current);
  }, [localValue, urlValue, key, delay, setSearchParams]);

  return [localValue, setLocalValue] as const;
}
