import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { apiClient } from '@/shared/lib/api-client';

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(
  path: string | null,
  params?: Record<string, string>,
  options?: { toastId?: string },
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState<string | null>(null);

  const serializedParams = params ? JSON.stringify(params) : '';
  const toastId = options?.toastId;

  const fetchData = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await apiClient.get<T>(
        path,
        serializedParams ? (JSON.parse(serializedParams) as Record<string, string>) : undefined,
      );
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      if (message !== 'Unauthorized') toast.error(message, { id: toastId ?? `api-error:${path}` });
    } finally {
      setLoading(false);
    }
  }, [path, serializedParams, toastId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
