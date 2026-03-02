import type {
  FullConfig,
  FullResult,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AssertlyReporter from '../src/index.js';

const { mockSendEvent, mockCheckHealth } = vi.hoisted(() => ({
  mockSendEvent: vi.fn().mockResolvedValue({ ok: true, eventId: 'evt-1', retries: 0 }),
  mockCheckHealth: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/client.js', () => {
  return {
    AssertlyClient: class MockAssertlyClient {
      sendEvent = mockSendEvent;
      checkHealth = mockCheckHealth;
    },
  };
});

function makeSuite(title: string, children: Suite[] = []): Suite {
  const suite: Suite = {
    title,
    suites: children,
    tests: [],
    type: title === '' ? 'root' : 'describe',
  } as unknown as Suite;
  for (const child of children) {
    (child as { parent: Suite }).parent = suite;
  }
  return suite;
}

describe('Event queue', () => {
  beforeEach(() => {
    mockSendEvent.mockClear();
    mockCheckHealth.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns about unsent events when flush timeout expires', async () => {
    mockSendEvent.mockImplementation(() => new Promise(() => {}));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.useFakeTimers();

    const reporter = new AssertlyReporter({
      apiUrl: 'https://api.test',
      projectToken: 'tok-123',
      flushTimeout: 100,
    });

    const root = makeSuite('', [makeSuite('project')]);
    await reporter.onBegin({} as FullConfig, root);

    const endPromise = reporter.onEnd({ status: 'passed' } as FullResult);
    await vi.advanceTimersByTimeAsync(200);
    await endPromise;

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unsent'));

    vi.useRealTimers();
  });

  it('warns and throws on health check failure based on config', async () => {
    mockCheckHealth.mockResolvedValue(false);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const root = makeSuite('', [makeSuite('project')]);

    const reporter1 = new AssertlyReporter({
      apiUrl: 'https://api.test',
      projectToken: 'tok-123',
    });
    await expect(reporter1.onBegin({} as FullConfig, root)).resolves.toBeUndefined();

    const reporter2 = new AssertlyReporter({
      apiUrl: 'https://api.test',
      projectToken: 'tok-123',
      failOnConnectionError: true,
    });
    await expect(reporter2.onBegin({} as FullConfig, root)).rejects.toThrow('Cannot reach');
  });

  it('drops oldest event when queue overflows', async () => {
    mockSendEvent.mockImplementation(() => new Promise(() => {}));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const reporter = new AssertlyReporter({
      apiUrl: 'https://api.test',
      projectToken: 'tok-123',
    });

    const root = makeSuite('', [makeSuite('project')]);
    await reporter.onBegin({} as FullConfig, root);

    const testParent = root.suites[0]!;
    for (let i = 0; i < 10_000; i++) {
      reporter.onTestEnd(
        {
          title: `test-${i}`,
          id: `id-${i}`,
          parent: testParent,
          outcome: () => 'expected',
        } as unknown as TestCase,
        {
          status: 'passed',
          duration: 1,
          retry: 0,
          error: undefined,
          attachments: [],
        } as unknown as TestResult,
      );
    }

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('dropping oldest'));
  });
});
