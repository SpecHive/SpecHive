import { useCallback, useEffect, useRef, useState } from 'react';
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
  const abortControllerRef = useRef<AbortController | null>(null);

  const serializedParams = params ? JSON.stringify(params) : '';
  const toastId = options?.toastId;

  const fetchData = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }

    // Abort any in-flight request before starting a new one
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.get<T>(
        path,
        serializedParams ? (JSON.parse(serializedParams) as Record<string, string>) : undefined,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) {
        setData(result);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      if (message !== 'Unauthorized') toast.error(message, { id: toastId ?? `api-error:${path}` });
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [path, serializedParams, toastId]);

  useEffect(() => {
    fetchData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
