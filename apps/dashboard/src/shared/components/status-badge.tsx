import { statusColorsBadge, statusColorsDot } from '@/shared/lib/constants';

interface StatusBadgeProps {
  status: string;
  large?: boolean;
  variant?: 'badge' | 'dot';
}

export function StatusBadge({ status, large, variant = 'badge' }: StatusBadgeProps) {
  if (variant === 'dot') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <span className={`h-2 w-2 rounded-full ${statusColorsDot[status] || 'bg-gray-400'}`} />
        {status}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium ${
        statusColorsBadge[status] || 'bg-gray-400 text-white'
      } ${large ? 'text-sm' : 'text-xs'}`}
    >
      {status}
    </span>
  );
}
