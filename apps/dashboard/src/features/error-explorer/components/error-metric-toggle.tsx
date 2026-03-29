import { useSearchParams } from 'react-router';

import { Button } from '@/shared/components/ui/button';

const METRICS = [
  { key: 'occurrences', label: 'Occurrences' },
  { key: 'uniqueTests', label: 'Affected Tests' },
  { key: 'uniqueBranches', label: 'Affected Branches' },
] as const;

export function ErrorMetricToggle() {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get('metric') || 'occurrences';

  const setMetric = (key: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('metric', key);
      return next;
    });
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Metric:</span>
      {METRICS.map(({ key, label }) => (
        <Button
          key={key}
          variant={active === key ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMetric(key)}
          aria-pressed={active === key}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
