import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

export interface TrendIndicatorProps {
  /** Optional primary value displayed before the delta badge, e.g. "92.3%" */
  value?: string;
  /** Numeric delta. null hides the badge entirely. */
  delta: number | null;
  /** When true (default), positive delta is good (green). Flip for metrics where lower = better. */
  positiveIsGood?: boolean | undefined;
  /** Suffix appended to the formatted delta (default: "%"). Pass "" for unit-less deltas. */
  unit?: string | undefined;
  className?: string | undefined;
}

interface BadgeConfig {
  icon: React.ReactNode;
  label: string;
  className: string;
}

function resolveBadge(delta: number, positiveIsGood: boolean, unit: string): BadgeConfig {
  if (delta === 0) {
    return {
      icon: <Minus className="h-3 w-3" />,
      label: `0.0${unit}`,
      className: 'bg-slate-100 text-slate-500',
    };
  }

  const isPositive = delta > 0;
  // Good means green; bad means red. Flip when positiveIsGood=false.
  const isGood = positiveIsGood ? isPositive : !isPositive;

  if (isPositive) {
    return {
      icon: <TrendingUp className="h-3 w-3" />,
      label: `+${delta.toFixed(1)}${unit}`,
      className: isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
    };
  }

  return {
    icon: <TrendingDown className="h-3 w-3" />,
    label: `${delta.toFixed(1)}${unit}`,
    className: isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
  };
}

export function TrendIndicator({
  value,
  delta,
  positiveIsGood = true,
  unit = '%',
  className,
}: TrendIndicatorProps) {
  if (delta === null) {
    return <span className={className}>{value}</span>;
  }

  const badge = resolveBadge(delta, positiveIsGood, unit);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      {value && <span>{value}</span>}
      <span
        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${badge.className}`}
      >
        {badge.icon}
        <span>{badge.label}</span>
      </span>
    </span>
  );
}
