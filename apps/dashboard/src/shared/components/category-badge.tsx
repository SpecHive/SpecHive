import { categoryColorsBadge } from '@/shared/lib/constants';

const categoryLabels: Record<string, string> = {
  assertion: 'Assertion',
  timeout: 'Timeout',
  action: 'Action',
  runtime: 'Other',
};

interface CategoryBadgeProps {
  category: string | null;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  const label = (category && categoryLabels[category]) || 'Other';
  const colors = (category && categoryColorsBadge[category]) || 'bg-gray-400 text-white';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}
    >
      {label}
    </span>
  );
}
