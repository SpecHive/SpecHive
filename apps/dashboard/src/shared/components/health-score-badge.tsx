export interface HealthScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md';
}

function resolveColorClasses(score: number): string {
  if (score >= 90) return 'bg-green-100 text-green-700';
  if (score >= 70) return 'bg-yellow-100 text-yellow-700';
  if (score >= 50) return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}

export function HealthScoreBadge({ score, size = 'sm' }: HealthScoreBadgeProps) {
  const colorClasses = resolveColorClasses(score);
  const sizeClasses =
    size === 'md' ? 'px-3 py-1 text-sm font-semibold' : 'px-2 py-0.5 text-xs font-semibold';

  return (
    <span
      className={`inline-block rounded-full ${sizeClasses} ${colorClasses}`}
      aria-label={`Health score: ${Math.round(score)} out of 100`}
    >
      {Math.round(score)}
    </span>
  );
}
