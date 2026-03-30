import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { PeriodSelector } from '@/shared/components/period-selector';
import { usePeriodSelector } from '@/shared/hooks/use-period-selector';
import { cn } from '@/shared/lib/utils';

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'assertion', label: 'Assertions' },
  { value: 'timeout', label: 'Timeouts' },
  { value: 'action', label: 'Actions' },
  { value: 'runtime', label: 'Runtime' },
] as const;

export function ErrorFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const { days, setDays, options } = usePeriodSelector({
    options: [7, 14, 30, 60, 90],
    defaultDays: 30,
    syncWithUrl: true,
  });

  const branch = searchParams.get('branch') || '';
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';

  const [searchInput, setSearchInput] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (searchInput === search) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (searchInput) {
          next.set('search', searchInput);
        } else {
          next.delete('search');
        }
        next.delete('page');
        return next;
      });
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput, search, setSearchParams]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <PeriodSelector options={options} value={days} onChange={setDays} />
      <div className="flex gap-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => updateParam('category', cat.value)}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
              category === cat.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={branch}
        onChange={(e) => updateParam('branch', e.target.value)}
        placeholder="Branch…"
        className="rounded-md border bg-background px-3 py-2 text-sm"
        aria-label="Filter by branch"
      />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search errors…"
          className="rounded-md border bg-background py-2 pl-9 pr-3 text-sm"
          aria-label="Search errors"
        />
      </div>
    </div>
  );
}
