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

describe('AssertlyClient', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn<typeof global.fetch>();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends event with correct URL, headers, and body', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ eventId: 'evt-1' }));

    const client = new AssertlyClient('https://api.test', 'tok-123');
    await client.sendEvent(MOCK_EVENT);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/v1/events');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      'x-project-token': 'tok-123',
    });
    expect(JSON.parse(init.body as string)).toEqual(MOCK_EVENT);
  });

  it('returns ok with eventId on success', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ eventId: 'evt-42' }));

    const client = new AssertlyClient('https://api.test', 'tok-123');
    const result = await client.sendEvent(MOCK_EVENT);

    expect(result).toEqual({ ok: true, eventId: 'evt-42' });
  });

  it('returns ok: false and warns on HTTP error', async () => {
    fetchSpy.mockResolvedValueOnce(textResponse('Bad Request', 400));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const client = new AssertlyClient('https://api.test', 'tok-123');
    const result = await client.sendEvent(MOCK_EVENT);

    expect(result).toEqual({ ok: false });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Event send failed (400)'));
  });

  it('returns ok: false and warns on network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network failure'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const client = new AssertlyClient('https://api.test', 'tok-123');
    const result = await client.sendEvent(MOCK_EVENT);

    expect(result).toEqual({ ok: false });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Network failure'));
  });

  it('returns ok: false on abort/timeout', async () => {
    fetchSpy.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(
            () => reject(new DOMException('The operation was aborted.', 'AbortError')),
            50,
          );
        }),
    );
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const client = new AssertlyClient('https://api.test', 'tok-123', 10);
    const result = await client.sendEvent(MOCK_EVENT);

    expect(result).toEqual({ ok: false });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Event send error'));
  });
});
