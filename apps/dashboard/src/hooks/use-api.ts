import { useCallback, useEffect, useState } from 'react';

import { apiClient } from '@/lib/api-client';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(path: string | null, params?: Record<string, string>): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serializedParams = params ? JSON.stringify(params) : '';

  const fetchData = useCallback(async () => {
    if (!path) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.get<T>(
        path,
        serializedParams ? (JSON.parse(serializedParams) as Record<string, string>) : undefined,
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [path, serializedParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
