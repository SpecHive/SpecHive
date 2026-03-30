import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { useDebouncedParam } from '../hooks/use-debounced-param';
import { useUpdateParam } from '../hooks/use-update-param';

import { cn } from '@/shared/lib/utils';

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'assertion', label: 'Assertions' },
  { value: 'timeout', label: 'Timeouts' },
  { value: 'action', label: 'Actions' },
  { value: 'other', label: 'Other' },
] as const;

export function ErrorTableFilters() {
  const [searchParams] = useSearchParams();
  const updateParam = useUpdateParam();
  const category = searchParams.get('category') || '';
  const [searchInput, setSearchInput] = useDebouncedParam('search');
  const [branchInput, setBranchInput] = useDebouncedParam('branch');

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 p-3 backdrop-blur-sm">
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
        value={branchInput}
        onChange={(e) => setBranchInput(e.target.value)}
        placeholder="Branch…"
        className="rounded-md border bg-background px-3 py-1.5 text-sm"
        aria-label="Filter by branch"
      />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search errors…"
          className="rounded-md border bg-background py-1.5 pl-9 pr-3 text-sm"
          aria-label="Search errors"
        />
      </div>
    </div>
  );
}
