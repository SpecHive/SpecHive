import { useApi } from '@/shared/hooks/use-api';
import type { ErrorGroupDetail } from '@/types/api';

export function useErrorGroupDetail(
  errorGroupId: string | null,
  dateFrom?: number,
  dateTo?: number,
) {
  const path = errorGroupId ? `/v1/errors/${errorGroupId}` : null;
  const params: Record<string, string> = {};
  if (dateFrom != null) params.dateFrom = String(dateFrom);
  if (dateTo != null) params.dateTo = String(dateTo);
  return useApi<ErrorGroupDetail>(path, params);
}
