import { useApi } from '@/shared/hooks/use-api';
import type { ErrorTimelineResponse } from '@/types/api';

interface UseErrorTimelineParams {
  projectId: string | null;
  dateFrom?: number | undefined;
  dateTo?: number | undefined;
  branch?: string | undefined;
  search?: string | undefined;
  category?: string | undefined;
  metric?: string | undefined;
  topN?: number | undefined;
}

export function useErrorTimeline(params: UseErrorTimelineParams) {
  const queryParams: Record<string, string> = {};

  if (params.projectId) queryParams.projectId = params.projectId;
  if (params.dateFrom != null) queryParams.dateFrom = String(params.dateFrom);
  if (params.dateTo != null) queryParams.dateTo = String(params.dateTo);
  if (params.branch) queryParams.branch = params.branch;
  if (params.search) queryParams.search = params.search;
  if (params.category) queryParams.category = params.category;
  if (params.metric) queryParams.metric = params.metric;
  if (params.topN) queryParams.topN = String(params.topN);

  const path = params.projectId ? '/v1/errors/timeline' : null;
  return useApi<ErrorTimelineResponse>(path, queryParams);
}
