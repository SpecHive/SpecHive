import { useApi } from '@/shared/hooks/use-api';
import type { ErrorGroupDetail } from '@/types/api';

export function useErrorGroupDetail(errorGroupId: string | null) {
  const path = errorGroupId ? `/v1/errors/${errorGroupId}` : null;
  return useApi<ErrorGroupDetail>(path);
}
