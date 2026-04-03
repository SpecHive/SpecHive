import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import { useAuth } from './auth-context';

import { apiClient } from '@/shared/lib/api-client';

// --- Types ---

export interface SseEvent {
  type: string;
  runId?: string;
}

type SseEventCallback = (event: SseEvent) => void;

interface SseContextValue {
  subscribe: (callback: SseEventCallback) => () => void;
}

// --- Constants ---

const INITIAL_RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

// --- Context ---

const SseContext = createContext<SseContextValue | null>(null);

// --- Provider ---

export function SseProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const subscribersRef = useRef<Set<SseEventCallback>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) return;

    let abortController: AbortController | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    let stopped = false;
    let hasConnectedBefore = false;

    function broadcast(event: SseEvent): void {
      for (const cb of subscribersRef.current) {
        cb(event);
      }
    }

    async function connect(): Promise<void> {
      if (stopped) return;

      abortController = new AbortController();

      try {
        const response = await apiClient.stream('/v1/sse/events', {
          headers: { Accept: 'text/event-stream' },
          signal: abortController.signal,
        });

        if (!response.body) return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        reconnectDelay = INITIAL_RECONNECT_DELAY_MS;

        if (hasConnectedBefore) {
          broadcast({ type: 'sse.reconnected' });
        }
        hasConnectedBefore = true;

        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const messages = buffer.split('\n\n');
          buffer = messages.pop() ?? '';

          for (const message of messages) {
            if (!message.trim()) continue;

            const lines = message.split('\n');
            const eventLine = lines.find((l) => l.startsWith('event:'));
            const eventType = eventLine?.slice(6).trim();

            if (eventType === 'heartbeat') continue;
            if (eventType !== 'notification') continue;

            const dataLines: string[] = [];
            for (const line of lines) {
              if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trimStart());
              }
            }
            if (dataLines.length === 0) continue;

            const data = dataLines.join('\n');
            if (!data) continue;

            try {
              const parsed = JSON.parse(data) as SseEvent;
              broadcast(parsed);
            } catch {
              // Skip malformed events
            }
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;

        // Token refresh failed and user is being redirected to login
        if (error instanceof Error && error.message === 'Unauthorized') return;
      }

      if (!stopped) {
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * BACKOFF_MULTIPLIER, MAX_RECONNECT_DELAY_MS);
      }
    }

    function handleVisibilityChange(): void {
      if (document.visibilityState !== 'visible' || stopped) return;

      // Only reconnect immediately if we're in a backoff wait
      // (stream already died). Don't kill healthy connections.
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
        reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
        void connect();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    void connect();

    return () => {
      stopped = true;
      abortController?.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated]);

  const subscribe = useCallback((callback: SseEventCallback) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  const value = useMemo(() => ({ subscribe }), [subscribe]);

  return <SseContext.Provider value={value}>{children}</SseContext.Provider>;
}

// --- Consumer hook ---

/**
 * Subscribe to SSE events from the singleton connection.
 * The callback receives all events including `{ type: 'sse.reconnected' }`
 * on reconnection — use this to refetch stale data.
 */
export function useSseSubscribe(callback: SseEventCallback): void {
  const context = useContext(SseContext);
  if (!context) {
    throw new Error('useSseSubscribe must be used within an SseProvider');
  }

  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handler: SseEventCallback = (event) => callbackRef.current(event);
    return context.subscribe(handler);
  }, [context]);
}
