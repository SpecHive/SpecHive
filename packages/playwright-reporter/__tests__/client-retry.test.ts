import type { V1Event } from '@assertly/reporter-core-protocol';
import { RunStatus, asRunId } from '@assertly/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AssertlyClient } from '../src/client.js';

const MOCK_EVENT: V1Event = {
  version: '1',
  timestamp: new Date().toISOString(),
  runId: asRunId('00000000-0000-0000-0000-000000000001'),
  eventType: 'run.end',
  payload: { status: RunStatus.Passed },
};

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status });
}

describe('AssertlyClient retry logic', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn<typeof global.fetch>();
    vi.stubGlobal('fetch', fetchSpy);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries on 500 and succeeds on second attempt', async () => {
    fetchSpy
      .mockResolvedValueOnce(textResponse('Internal Server Error', 500))
      .mockResolvedValueOnce(jsonResponse({ eventId: 'evt-1' }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const client = new AssertlyClient('https://api.test', 'tok-123', 10_000, 3);
    const promise = client.sendEvent(MOCK_EVENT);

    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(result.retries).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 400', async () => {
    fetchSpy.mockResolvedValueOnce(textResponse('Bad Request', 400));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const client = new AssertlyClient('https://api.test', 'tok-123', 10_000, 3);
    const result = await client.sendEvent(MOCK_EVENT);

    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.retries).toBe(0);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('exhausts max retries on persistent 503', async () => {
    fetchSpy.mockResolvedValue(textResponse('Service Unavailable', 503));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const maxRetries = 2;
    const client = new AssertlyClient('https://api.test', 'tok-123', 10_000, maxRetries);
    const promise = client.sendEvent(MOCK_EVENT);

    for (let i = 0; i < maxRetries; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
    }
    const result = await promise;

    expect(result.ok).toBe(false);
    expect(result.retries).toBe(maxRetries);
    expect(fetchSpy).toHaveBeenCalledTimes(maxRetries + 1);
  });
});
