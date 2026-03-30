import { useApi } from '@/shared/hooks/use-api';
import type { ErrorGroupSummary, PaginatedResponse } from '@/types/api';

interface UseErrorGroupsParams {
  projectId: string | null;
  dateFrom?: number | undefined;
  dateTo?: number | undefined;
  branch?: string | undefined;
  search?: string | undefined;
  category?: string | undefined;
  sortBy?: string | null | undefined;
  sortOrder?: string | null | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export function useErrorGroups(params: UseErrorGroupsParams) {
  const queryParams: Record<string, string> = {};

  if (params.projectId) queryParams.projectId = params.projectId;
  if (params.dateFrom != null) queryParams.dateFrom = String(params.dateFrom);
  if (params.dateTo != null) queryParams.dateTo = String(params.dateTo);
  if (params.branch) queryParams.branch = params.branch;
  if (params.search) queryParams.search = params.search;
  if (params.category) queryParams.category = params.category;
  if (params.sortBy) queryParams.sortBy = params.sortBy;
  if (params.sortOrder) queryParams.sortOrder = params.sortOrder;
  if (params.page != null) queryParams.page = String(params.page);
  if (params.pageSize != null) queryParams.pageSize = String(params.pageSize);

  const path = params.projectId ? '/v1/errors' : null;
  return useApi<PaginatedResponse<ErrorGroupSummary>>(path, queryParams);
}
