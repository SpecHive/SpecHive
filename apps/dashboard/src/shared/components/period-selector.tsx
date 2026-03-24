import { Button } from '@/shared/components/ui/button';

interface PeriodSelectorProps {
  options: readonly number[];
  value: number;
  onChange: (days: number) => void;
}

export function PeriodSelector({ options, value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Period:</span>
      {options.map((days) => (
        <Button
          key={days}
          variant={value === days ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(days)}
          aria-pressed={value === days}
        >
          {days}d
        </Button>
      ))}
    </div>
  );
}
