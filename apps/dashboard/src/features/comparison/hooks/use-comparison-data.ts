import { useApi } from '@/shared/hooks/use-api';
import type { ProjectComparisonResponse } from '@/types/api';

export function useComparisonData(projectIds: string[], isAllSelected: boolean, days: number) {
  const comparisonParams: Record<string, string> = { days: String(days) };
  if (!isAllSelected) comparisonParams.projectIds = projectIds.join(',');

  const { data, loading, error } = useApi<ProjectComparisonResponse>(
    '/v1/analytics/project-comparison',
    comparisonParams,
    { toastId: 'api-error:analytics' },
  );

  return { data, loading, error };
}
