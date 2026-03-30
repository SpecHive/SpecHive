import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

export function useDebouncedParam(key: string, delay = 300) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlValue = searchParams.get(key) || '';
  const [localValue, setLocalValue] = useState(urlValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (localValue === urlValue) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
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
