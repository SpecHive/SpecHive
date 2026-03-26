import type { V1Event } from '@spechive/reporter-core-protocol';
import { RunStatus, asRunId } from '@spechive/shared-types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SpecHiveClient } from '../src/client.js';
import { ReporterQueue } from '../src/queue.js';

function makeEvent(eventType: string = 'run.end'): V1Event {
  return {
    version: '1',
    timestamp: new Date().toISOString(),
    runId: asRunId('00000000-0000-0000-0000-000000000001'),
    eventType: eventType as V1Event['eventType'],
    payload: { status: RunStatus.Passed },
  } as V1Event;
}

function makeMockClient(
  sendEvent = vi.fn().mockResolvedValue({ ok: true, eventId: 'evt-1', retries: 0 }),
): SpecHiveClient {
  return { sendEvent } as unknown as SpecHiveClient;
}

describe('ReporterQueue', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('resolves waitForDrain immediately when queue is empty', async () => {
    const queue = new ReporterQueue(makeMockClient(), { flushTimeout: 1000 });

    await queue.waitForDrain();
    expect(queue.stats.eventsSent).toBe(0);
  });

  it('sends events one-at-a-time through the client', async () => {
    const sendEvent = vi.fn().mockResolvedValue({ ok: true, eventId: 'evt-1', retries: 0 });
    const queue = new ReporterQueue(makeMockClient(sendEvent), { flushTimeout: 5000 });

    queue.enqueue(makeEvent('run.start'));
    queue.enqueue(makeEvent('test.start'));
    queue.enqueue(makeEvent('test.end'));

    await queue.waitForDrain();

    expect(sendEvent).toHaveBeenCalledTimes(3);
    expect(queue.stats.eventsSent).toBe(3);
    expect(queue.stats.eventsFailed).toBe(0);
  });

  it('accumulates stats correctly for mixed success/failure', async () => {
    const sendEvent = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, eventId: 'evt-1', retries: 0 })
      .mockResolvedValueOnce({ ok: false, retries: 2 })
      .mockResolvedValueOnce({ ok: true, eventId: 'evt-3', retries: 1 });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const queue = new ReporterQueue(makeMockClient(sendEvent), { flushTimeout: 5000 });

    queue.enqueue(makeEvent());
    queue.enqueue(makeEvent());
    queue.enqueue(makeEvent());

    await queue.waitForDrain();

    expect(queue.stats.eventsSent).toBe(2);
    expect(queue.stats.eventsFailed).toBe(1);
    expect(queue.stats.retriesTotal).toBe(3);
  });

  it('drops oldest event and warns when queue overflows', async () => {
    const sendEvent = vi.fn().mockImplementation(() => new Promise(() => {}));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const queue = new ReporterQueue(makeMockClient(sendEvent), {
      flushTimeout: 5000,
      maxQueueSize: 5,
    });

    // First event starts processing (drainLoop), remaining 5 fill the queue
    for (let i = 0; i < 7; i++) {
      queue.enqueue(makeEvent());
    }

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('dropping oldest'));
  });

  it('warns about unsent events when flush timeout expires', async () => {
    const sendEvent = vi.fn().mockImplementation(() => new Promise(() => {}));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.useFakeTimers();

    const queue = new ReporterQueue(makeMockClient(sendEvent), { flushTimeout: 100 });

    queue.enqueue(makeEvent());
    queue.enqueue(makeEvent());

    const drainPromise = queue.waitForDrain();
    await vi.advanceTimersByTimeAsync(200);
    await drainPromise;

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unsent'));
  });

  it('resolves multiple concurrent waitForDrain calls', async () => {
    let resolveFirst!: () => void;
    const sendEvent = vi.fn().mockImplementation(
      () =>
        new Promise<{ ok: boolean; retries: number }>((resolve) => {
          resolveFirst = () => resolve({ ok: true, retries: 0 });
        }),
    );

    const queue = new ReporterQueue(makeMockClient(sendEvent), { flushTimeout: 5000 });

    queue.enqueue(makeEvent());

    const drain1 = queue.waitForDrain();
    const drain2 = queue.waitForDrain();

    // Resolve the single pending event
    resolveFirst();

    await Promise.all([drain1, drain2]);
    // Both promises should resolve without timeout
    expect(queue.stats.eventsSent).toBe(1);
  });
});
