import { act, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SseProvider, useSseSubscribe } from '@/contexts/sse-context';
import { apiClient } from '@/shared/lib/api-client';

// --- Mocks ---

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: {
    stream: vi.fn(),
  },
}));

vi.mock('./auth-context', () => ({
  useAuth: vi.fn(() => ({ isAuthenticated: true })),
}));

// --- Helpers ---

/**
 * Flushes all pending microtasks (Promise resolutions) without advancing
 * fake timers. Equivalent to the missing vi.runAllMicrotasksAsync in Vitest 4.
 */
function flushPromises(): Promise<void> {
  return act(() => Promise.resolve());
}

/**
 * Creates a ReadableStream paired with a controller that lets tests push
 * raw SSE chunks and close the stream on demand.
 */
function makeStream(): {
  stream: ReadableStream<Uint8Array>;
  push: (chunk: string) => void;
  close: () => void;
} {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  return {
    stream,
    push(chunk: string) {
      controller.enqueue(encoder.encode(chunk));
    },
    close() {
      controller.close();
    },
  };
}

/** Wraps a ReadableStream in a Response the way apiClient.stream resolves. */
function makeStreamResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream);
}

function wrapper({ children }: { children: ReactNode }) {
  return <SseProvider>{children}</SseProvider>;
}

// --- Tests ---

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('SseProvider', () => {
  it('connects when authenticated and broadcasts parsed notification events to subscribers', async () => {
    const { push, close, stream } = makeStream();
    vi.mocked(apiClient.stream).mockResolvedValue(makeStreamResponse(stream));

    const callback = vi.fn();
    const { unmount } = renderHook(() => useSseSubscribe(callback), { wrapper });

    // Let connect() resolve and the reader loop reach its first read() await
    await flushPromises();

    await act(async () => {
      push('event: notification\ndata: {"type":"run.updated","runId":"r-1"}\n\n');
      await flushPromises();
    });

    expect(callback).toHaveBeenCalledWith({ type: 'run.updated', runId: 'r-1' });

    close();
    unmount();
  });

  it('does not invoke subscriber for heartbeat events', async () => {
    const { push, close, stream } = makeStream();
    vi.mocked(apiClient.stream).mockResolvedValue(makeStreamResponse(stream));

    const callback = vi.fn();
    const { unmount } = renderHook(() => useSseSubscribe(callback), { wrapper });

    await flushPromises();

    await act(async () => {
      push('event: heartbeat\ndata: \n\n');
      await flushPromises();
    });

    expect(callback).not.toHaveBeenCalled();

    close();
    unmount();
  });

  it('does not invoke subscriber for events without notification type', async () => {
    const { push, close, stream } = makeStream();
    vi.mocked(apiClient.stream).mockResolvedValue(makeStreamResponse(stream));

    const callback = vi.fn();
    const { unmount } = renderHook(() => useSseSubscribe(callback), { wrapper });

    await flushPromises();

    await act(async () => {
      // No "event:" line at all — should be skipped
      push('data: {"type":"run.updated","runId":"r-2"}\n\n');
      await flushPromises();
    });

    expect(callback).not.toHaveBeenCalled();

    close();
    unmount();
  });

  it('schedules reconnect with exponential backoff when stream ends', async () => {
    const first = makeStream();
    const second = makeStream();

    vi.mocked(apiClient.stream)
      .mockResolvedValueOnce(makeStreamResponse(first.stream))
      .mockResolvedValue(makeStreamResponse(second.stream));

    const { unmount } = render(
      <SseProvider>
        <span />
      </SseProvider>,
    );

    // Let first connect() resolve and reach the reader loop
    await flushPromises();

    // Close the first stream so connect() exits the while-loop and registers setTimeout
    await act(async () => {
      first.close();
      await flushPromises();
    });

    expect(apiClient.stream).toHaveBeenCalledTimes(1);

    // Advance past INITIAL_RECONNECT_DELAY_MS (3000 ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
      await flushPromises();
    });

    expect(apiClient.stream).toHaveBeenCalledTimes(2);

    second.close();
    unmount();
  });

  it('broadcasts sse.reconnected synthetic event on successful reconnection', async () => {
    const first = makeStream();
    const second = makeStream();

    vi.mocked(apiClient.stream)
      .mockResolvedValueOnce(makeStreamResponse(first.stream))
      .mockResolvedValue(makeStreamResponse(second.stream));

    const callback = vi.fn();
    const { unmount } = renderHook(() => useSseSubscribe(callback), { wrapper });

    await flushPromises();

    // Close first stream — triggers backoff timer
    await act(async () => {
      first.close();
      await flushPromises();
    });

    // Fire the backoff timer and let the second connect() resolve
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
      await flushPromises();
    });

    expect(callback).toHaveBeenCalledWith({ type: 'sse.reconnected' });

    second.close();
    unmount();
  });

  it('resets backoff delay to initial value on successful reconnection', async () => {
    const first = makeStream();
    const second = makeStream();
    const third = makeStream();

    vi.mocked(apiClient.stream)
      .mockResolvedValueOnce(makeStreamResponse(first.stream))
      .mockResolvedValueOnce(makeStreamResponse(second.stream))
      .mockResolvedValue(makeStreamResponse(third.stream));

    const { unmount } = render(
      <SseProvider>
        <span />
      </SseProvider>,
    );

    await flushPromises();

    // First stream dies — schedules reconnect at 3000 ms, backoff doubles to 6000 ms
    await act(async () => {
      first.close();
      await flushPromises();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
      await flushPromises();
    });

    // Second stream connects successfully (resets backoff to 3000 ms) then dies
    await act(async () => {
      second.close();
      await flushPromises();
    });

    // If backoff had NOT reset it would be 6000 ms, so 3000 ms would not be enough.
    // If it reset to 3000 ms, a third call happens within 3000 ms.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
      await flushPromises();
    });

    expect(apiClient.stream).toHaveBeenCalledTimes(3);

    third.close();
    unmount();
  });

  it('reconnects immediately on visibility change when in backoff', async () => {
    const first = makeStream();
    const second = makeStream();

    vi.mocked(apiClient.stream)
      .mockResolvedValueOnce(makeStreamResponse(first.stream))
      .mockResolvedValue(makeStreamResponse(second.stream));

    const { unmount } = render(
      <SseProvider>
        <span />
      </SseProvider>,
    );

    await flushPromises();

    // First stream dies — a 3000 ms backoff timer is now pending
    await act(async () => {
      first.close();
      await flushPromises();
    });

    expect(apiClient.stream).toHaveBeenCalledTimes(1);

    // Tab becomes visible before the 3000 ms backoff elapses
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await flushPromises();
    });

    // Should have reconnected immediately without waiting the full backoff delay
    expect(apiClient.stream).toHaveBeenCalledTimes(2);

    second.close();
    unmount();
  });

  it('does not reconnect on visibility change when stream is still healthy', async () => {
    // Stream stays open — reconnectTimer is never set
    const { stream } = makeStream();
    vi.mocked(apiClient.stream).mockResolvedValue(makeStreamResponse(stream));

    const { unmount } = render(
      <SseProvider>
        <span />
      </SseProvider>,
    );

    await flushPromises();

    expect(apiClient.stream).toHaveBeenCalledTimes(1);

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await flushPromises();
    });

    // Visibility handler only acts when reconnectTimer is pending — no extra call
    expect(apiClient.stream).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('aborts the stream and removes the visibility listener on unmount', async () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { stream } = makeStream();
    let capturedSignal: AbortSignal | undefined;

    vi.mocked(apiClient.stream).mockImplementation((_path, init) => {
      capturedSignal = (init as RequestInit | undefined)?.signal as AbortSignal | undefined;
      return Promise.resolve(makeStreamResponse(stream));
    });

    const { unmount } = render(
      <SseProvider>
        <span />
      </SseProvider>,
    );

    await flushPromises();

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(false);

    unmount();

    expect(capturedSignal!.aborted).toBe(true);
    expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});

describe('useSseSubscribe', () => {
  it('throws when used outside SseProvider', () => {
    // Suppress the expected React error boundary console output
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => {
      renderHook(() => useSseSubscribe(vi.fn()));
    }).toThrow('useSseSubscribe must be used within an SseProvider');

    consoleError.mockRestore();
  });
});
