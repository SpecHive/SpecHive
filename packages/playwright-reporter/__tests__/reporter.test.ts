import type { V1Event } from '@assertly/reporter-core-protocol';
import { ArtifactType, RunStatus, TestStatus } from '@assertly/shared-types';
import type {
  FullConfig,
  FullResult,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AssertlyReporter from '../src/index.js';
import type { AssertlyReporterConfig } from '../src/types.js';

const { mockSendEvent, mockCheckHealth, mockReadFile } = vi.hoisted(() => ({
  mockSendEvent: vi.fn().mockResolvedValue({ ok: true, eventId: 'evt-1', retries: 0 }),
  mockCheckHealth: vi.fn().mockResolvedValue(true),
  mockReadFile: vi.fn(),
}));

vi.mock('../src/client.js', () => {
  return {
    AssertlyClient: class MockAssertlyClient {
      sendEvent = mockSendEvent;
      checkHealth = mockCheckHealth;
    },
  };
});

vi.mock('node:fs/promises', () => ({ readFile: mockReadFile }));

function makeConfig(): AssertlyReporterConfig {
  return { apiUrl: 'https://api.test', projectToken: 'tok-123' };
}

function makeSuite(title: string, children: Suite[] = [], tests: TestCase[] = []): Suite {
  const suite: Suite = {
    title,
    suites: children,
    tests,
    type: title === '' ? 'root' : 'describe',
  } as unknown as Suite;
  for (const child of children) {
    (child as { parent: Suite }).parent = suite;
  }
  for (const test of tests) {
    (test as { parent: Suite }).parent = suite;
  }
  return suite;
}

function makeTest(title: string, parent?: Suite): TestCase {
  return {
    title,
    parent,
    id: `test-${title}`,
    outcome: () => 'expected',
  } as unknown as TestCase;
}

function makeTestResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    status: 'passed',
    duration: 150,
    retry: 0,
    error: undefined,
    attachments: [],
    ...overrides,
  } as unknown as TestResult;
}

async function flushQueue(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe('AssertlyReporter', () => {
  let reporter: AssertlyReporter;

  beforeEach(() => {
    mockSendEvent.mockClear();
    mockCheckHealth.mockClear();
    mockReadFile.mockReset();
    reporter = new AssertlyReporter(makeConfig());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('defaults enabled to true', () => {
      expect(reporter.isEnabled).toBe(true);
    });

    it('respects enabled: false', () => {
      const r = new AssertlyReporter({ ...makeConfig(), enabled: false });
      expect(r.isEnabled).toBe(false);
    });
  });

  describe('onBegin', () => {
    it('sends run.start with project suite title', async () => {
      const projectSuite = makeSuite('my-project');
      const rootSuite = makeSuite('', [projectSuite]);

      await reporter.onBegin({} as FullConfig, rootSuite);
      await flushQueue();

      const events = sentEvents();
      const runStart = events.find((e) => e.eventType === 'run.start');
      expect(runStart).toBeDefined();
      expect(runStart!.payload.runName).toBe('my-project');
    });

    it('falls back to "Playwright Run" when no project suite', async () => {
      const rootSuite = makeSuite('', []);

      await reporter.onBegin({} as FullConfig, rootSuite);
      await flushQueue();

      const events = sentEvents();
      const runStart = events.find((e) => e.eventType === 'run.start');
      expect(runStart!.payload.runName).toBe('Playwright Run');
    });

    it('sends suite.start for each child suite with parent relationships', async () => {
      const grandchild = makeSuite('grandchild');
      const child = makeSuite('child', [grandchild]);
      const root = makeSuite('', [child]);

      await reporter.onBegin({} as FullConfig, root);
      await flushQueue();

      const events = sentEvents();
      const suiteEvents = events.filter((e) => e.eventType === 'suite.start');
      expect(suiteEvents).toHaveLength(2);

      const childEvent = suiteEvents[0]!;
      expect(childEvent.payload.suiteName).toBe('child');
      expect(childEvent.payload.parentSuiteId).toBeUndefined();

      const grandchildEvent = suiteEvents[1]!;
      expect(grandchildEvent.payload.suiteName).toBe('grandchild');
      expect(grandchildEvent.payload.parentSuiteId).toBe(childEvent.payload.suiteId);
    });

    it('does nothing when disabled', async () => {
      const r = new AssertlyReporter({ ...makeConfig(), enabled: false });
      mockSendEvent.mockClear();
      await r.onBegin({} as FullConfig, makeSuite(''));
      expect(mockSendEvent).not.toHaveBeenCalled();
    });

    it('calls checkHealth and continues on success', async () => {
      const rootSuite = makeSuite('', [makeSuite('project')]);
      await reporter.onBegin({} as FullConfig, rootSuite);
      expect(mockCheckHealth).toHaveBeenCalledOnce();
    });

    it('warns but continues when health check fails', async () => {
      mockCheckHealth.mockResolvedValueOnce(false);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const rootSuite = makeSuite('', [makeSuite('project')]);

      await reporter.onBegin({} as FullConfig, rootSuite);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot reach'));
    });

    it('throws when health check fails and failOnConnectionError is true', async () => {
      mockCheckHealth.mockResolvedValueOnce(false);
      const r = new AssertlyReporter({ ...makeConfig(), failOnConnectionError: true });
      const rootSuite = makeSuite('', [makeSuite('project')]);

      await expect(r.onBegin({} as FullConfig, rootSuite)).rejects.toThrow('Cannot reach');
    });
  });

  describe('onTestEnd', () => {
    it('sends test.start on first attempt but defers test.end to onEnd', async () => {
      const child = makeSuite('my-suite');
      const root = makeSuite('', [child]);
      await reporter.onBegin({} as FullConfig, root);
      await flushQueue();
      mockSendEvent.mockClear();

      const test = makeTest('should pass', child);
      reporter.onTestEnd(test, makeTestResult({ status: 'passed', duration: 200 }));
      await flushQueue();

      const events = sentEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.eventType).toBe('test.start');
      expect(events[0]!.payload.testName).toBe('should pass');

      // test.end is sent during onEnd
      mockSendEvent.mockClear();
      await reporter.onEnd({ status: 'passed' } as FullResult);

      const endEvents = sentEvents();
      const testEnd = endEvents.find((e) => e.eventType === 'test.end');
      expect(testEnd).toBeDefined();
      expect(testEnd!.payload.status).toBe(TestStatus.Passed);
      expect(testEnd!.payload.durationMs).toBe(200);
    });

    it.each([
      ['failed', TestStatus.Failed],
      ['timedOut', TestStatus.Failed],
      ['interrupted', TestStatus.Failed],
      ['skipped', TestStatus.Skipped],
    ] as const)('maps Playwright status "%s" to %s', async (pwStatus, expected) => {
      const child = makeSuite('suite');
      const root = makeSuite('', [child]);
      await reporter.onBegin({} as FullConfig, root);
      await flushQueue();
      mockSendEvent.mockClear();

      const test = makeTest('test', child);
      (test as { outcome: () => string }).outcome = () =>
        pwStatus === 'skipped' ? 'skipped' : 'unexpected';
      reporter.onTestEnd(test, makeTestResult({ status: pwStatus }));
      await reporter.onEnd({ status: 'passed' } as FullResult);

      const events = sentEvents();
      const testEnd = events.find((e) => e.eventType === 'test.end');
      expect(testEnd!.payload.status).toBe(expected);
    });

    it('truncates error message and stack trace', async () => {
      const child = makeSuite('suite');
      const root = makeSuite('', [child]);
      await reporter.onBegin({} as FullConfig, root);
      await flushQueue();
      mockSendEvent.mockClear();

      const longMessage = 'x'.repeat(20_000);
      const longStack = 'y'.repeat(100_000);
      const test = makeTest('test', child);
      (test as { outcome: () => string }).outcome = () => 'unexpected';
      reporter.onTestEnd(
        test,
        makeTestResult({
          status: 'failed',
          error: { message: longMessage, stack: longStack } as TestResult['error'],
        }),
      );
      await reporter.onEnd({ status: 'passed' } as FullResult);

      const events = sentEvents();
      const testEnd = events.find((e) => e.eventType === 'test.end');
      expect(testEnd!.payload.errorMessage.length).toBe(10_000);
      expect(testEnd!.payload.stackTrace.length).toBe(50_000);
    });

    it('includes retryCount from result', async () => {
      const child = makeSuite('suite');
      const root = makeSuite('', [child]);
      await reporter.onBegin({} as FullConfig, root);
      await flushQueue();
      mockSendEvent.mockClear();

      const test = makeTest('test', child);
      reporter.onTestEnd(test, makeTestResult({ retry: 2 }));
      await reporter.onEnd({ status: 'passed' } as FullResult);

      const events = sentEvents();
      const testEnd = events.find((e) => e.eventType === 'test.end');
      expect(testEnd!.payload.retryCount).toBe(2);
    });

    it('does nothing when disabled', async () => {
      const r = new AssertlyReporter({ ...makeConfig(), enabled: false });
      mockSendEvent.mockClear();
      r.onTestEnd(makeTest('test'), makeTestResult());
      expect(mockSendEvent).not.toHaveBeenCalled();
    });
  });

  describe('flaky detection', () => {
    async function beginReporter(): Promise<{ reporter: AssertlyReporter; suite: Suite }> {
      const r = new AssertlyReporter(makeConfig());
      const child = makeSuite('suite');
      const root = makeSuite('', [child]);
      await r.onBegin({} as FullConfig, root);
      await flushQueue();
      mockSendEvent.mockClear();
      return { reporter: r, suite: child };
    }

    it('reports passed when test passes first try', async () => {
      const { reporter: r } = await beginReporter();
      const test = makeTest('passes-first', undefined);
      r.onTestEnd(test, makeTestResult({ status: 'passed', retry: 0 }));
      await r.onEnd({ status: 'passed' } as FullResult);

      const events = sentEvents();
      const testEnd = events.find((e) => e.eventType === 'test.end');
      expect(testEnd!.payload.status).toBe(TestStatus.Passed);
      expect(testEnd!.payload.retryCount).toBe(0);
    });

    it('reports failed when test fails all retries', async () => {
      const { reporter: r } = await beginReporter();
      const test = makeTest('fails-all', undefined);
      (test as { outcome: () => string }).outcome = () => 'unexpected';

      r.onTestEnd(test, makeTestResult({ status: 'failed', retry: 0 }));
      r.onTestEnd(test, makeTestResult({ status: 'failed', retry: 1 }));
      r.onTestEnd(test, makeTestResult({ status: 'failed', retry: 2 }));
      await r.onEnd({ status: 'failed' } as FullResult);

      const events = sentEvents();
      const testEnd = events.find((e) => e.eventType === 'test.end');
      expect(testEnd!.payload.status).toBe(TestStatus.Failed);
      expect(testEnd!.payload.retryCount).toBe(2);
    });

    it('reports flaky when test fails then passes', async () => {
      const { reporter: r } = await beginReporter();
      const test = makeTest('flaky-test', undefined);
      (test as { outcome: () => string }).outcome = () => 'flaky';

      const failError = { message: 'assertion failed', stack: 'at test.ts:10' };
      r.onTestEnd(
        test,
        makeTestResult({
          status: 'failed',
          retry: 0,
          error: failError as TestResult['error'],
        }),
      );
      r.onTestEnd(
        test,
        makeTestResult({
          status: 'failed',
          retry: 1,
          error: failError as TestResult['error'],
        }),
      );
      r.onTestEnd(test, makeTestResult({ status: 'passed', retry: 2, duration: 300 }));
      await r.onEnd({ status: 'passed' } as FullResult);

      const events = sentEvents();
      const testEnd = events.find((e) => e.eventType === 'test.end');
      expect(testEnd!.payload.status).toBe(TestStatus.Flaky);
      expect(testEnd!.payload.retryCount).toBe(2);
      expect(testEnd!.payload.errorMessage).toBe('assertion failed');
      expect(testEnd!.payload.stackTrace).toBe('at test.ts:10');
    });

    it('sends test.start only once regardless of retries', async () => {
      const { reporter: r } = await beginReporter();
      const test = makeTest('retried-test', undefined);
      (test as { outcome: () => string }).outcome = () => 'flaky';

      r.onTestEnd(test, makeTestResult({ status: 'failed', retry: 0 }));
      r.onTestEnd(test, makeTestResult({ status: 'passed', retry: 1 }));
      await flushQueue();

      const events = sentEvents();
      const testStarts = events.filter((e) => e.eventType === 'test.start');
      expect(testStarts).toHaveLength(1);
    });

    it('sends test.end only during onEnd, not during onTestEnd', async () => {
      const { reporter: r } = await beginReporter();
      const test = makeTest('deferred-end', undefined);

      r.onTestEnd(test, makeTestResult({ status: 'passed', retry: 0 }));
      await flushQueue();

      const eventsBeforeOnEnd = sentEvents();
      expect(eventsBeforeOnEnd.filter((e) => e.eventType === 'test.end')).toHaveLength(0);

      await r.onEnd({ status: 'passed' } as FullResult);

      const eventsAfterOnEnd = sentEvents();
      expect(eventsAfterOnEnd.filter((e) => e.eventType === 'test.end')).toHaveLength(1);
    });

    it('preserves error from failed attempt in flaky test', async () => {
      const { reporter: r } = await beginReporter();
      const test = makeTest('flaky-error', undefined);
      (test as { outcome: () => string }).outcome = () => 'flaky';

      r.onTestEnd(
        test,
        makeTestResult({
          status: 'failed',
          retry: 0,
          error: { message: 'first failure', stack: 'stack-1' } as TestResult['error'],
        }),
      );
      r.onTestEnd(test, makeTestResult({ status: 'passed', retry: 1 }));
      await r.onEnd({ status: 'passed' } as FullResult);

      const events = sentEvents();
      const testEnd = events.find((e) => e.eventType === 'test.end');
      expect(testEnd!.payload.errorMessage).toBe('first failure');
      expect(testEnd!.payload.stackTrace).toBe('stack-1');
    });
  });

  describe('artifact capture', () => {
    async function setupReporter(
      config?: Partial<AssertlyReporterConfig>,
    ): Promise<AssertlyReporter> {
      const r = new AssertlyReporter({ ...makeConfig(), ...config });
      const child = makeSuite('suite');
      const root = makeSuite('', [child]);
      await r.onBegin({} as FullConfig, root);
      await flushQueue();
      mockSendEvent.mockClear();
      return r;
    }

    function collectArtifactEvents(): V1Event[] {
      return sentEvents().filter((e) => e.eventType === 'artifact.upload');
    }

    it('sends artifact.upload for attachment with path', async () => {
      const r = await setupReporter();
      const content = Buffer.from('screenshot-data');
      mockReadFile.mockResolvedValue(content);

      const test = makeTest('test');
      r.onTestEnd(
        test,
        makeTestResult({
          attachments: [
            { name: 'screenshot.png', contentType: 'image/png', path: '/tmp/screenshot.png' },
          ],
        }),
      );
      await r.onEnd({ status: 'passed' } as FullResult);

      const artifacts = collectArtifactEvents();
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]!.payload.data).toBe(content.toString('base64'));
      expect(artifacts[0]!.payload.artifactType).toBe(ArtifactType.Screenshot);
      expect(artifacts[0]!.payload.name).toBe('screenshot.png');
      expect(artifacts[0]!.payload.mimeType).toBe('image/png');
    });

    it('sends artifact.upload for attachment with body', async () => {
      const r = await setupReporter();
      const body = Buffer.from('inline-body');

      const test = makeTest('test');
      r.onTestEnd(
        test,
        makeTestResult({
          attachments: [{ name: 'log.txt', contentType: 'text/plain', body }],
        }),
      );
      await r.onEnd({ status: 'passed' } as FullResult);

      const artifacts = collectArtifactEvents();
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]!.payload.data).toBe(body.toString('base64'));
    });

    it('skips attachment with neither path nor body', async () => {
      const r = await setupReporter();

      const test = makeTest('test');
      r.onTestEnd(
        test,
        makeTestResult({
          attachments: [{ name: 'empty', contentType: 'text/plain' }],
        }),
      );
      await r.onEnd({ status: 'passed' } as FullResult);

      expect(collectArtifactEvents()).toHaveLength(0);
    });

    it.each([
      ['image/png', ArtifactType.Screenshot],
      ['image/jpeg', ArtifactType.Screenshot],
      ['video/webm', ArtifactType.Video],
      ['application/zip', ArtifactType.Trace],
      ['text/plain', ArtifactType.Log],
      ['application/octet-stream', ArtifactType.Other],
    ] as const)('maps content type "%s" to %s', async (contentType, expected) => {
      const r = await setupReporter();

      const test = makeTest('test');
      r.onTestEnd(
        test,
        makeTestResult({
          attachments: [{ name: 'file', contentType, body: Buffer.from('x') }],
        }),
      );
      await r.onEnd({ status: 'passed' } as FullResult);

      const artifacts = collectArtifactEvents();
      expect(artifacts[0]!.payload.artifactType).toBe(expected);
    });

    it('skips oversized artifacts with console.error', async () => {
      const r = await setupReporter();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const oversized = Buffer.alloc(11 * 1024 * 1024);

      const test = makeTest('test');
      r.onTestEnd(
        test,
        makeTestResult({
          attachments: [{ name: 'huge.png', contentType: 'image/png', body: oversized }],
        }),
      );
      await r.onEnd({ status: 'passed' } as FullResult);

      expect(collectArtifactEvents()).toHaveLength(0);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping artifact'));
    });

    it('warns for large artifacts but still sends them', async () => {
      const r = await setupReporter();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const large = Buffer.alloc(6 * 1024 * 1024);

      const test = makeTest('test');
      r.onTestEnd(
        test,
        makeTestResult({
          attachments: [{ name: 'big.png', contentType: 'image/png', body: large }],
        }),
      );
      await r.onEnd({ status: 'passed' } as FullResult);

      expect(collectArtifactEvents()).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Large artifact'));
    });

    it('does not send artifacts when captureArtifacts is false', async () => {
      const r = await setupReporter({ captureArtifacts: false });

      const test = makeTest('test');
      r.onTestEnd(
        test,
        makeTestResult({
          attachments: [
            { name: 'screenshot.png', contentType: 'image/png', body: Buffer.from('x') },
          ],
        }),
      );
      await r.onEnd({ status: 'passed' } as FullResult);

      expect(collectArtifactEvents()).toHaveLength(0);
    });

    it('sanitizes artifact names', async () => {
      const r = await setupReporter();

      const test = makeTest('test');
      r.onTestEnd(
        test,
        makeTestResult({
          attachments: [
            { name: '../../../etc/passwd', contentType: 'text/plain', body: Buffer.from('x') },
          ],
        }),
      );
      await r.onEnd({ status: 'passed' } as FullResult);

      const artifacts = collectArtifactEvents();
      expect(artifacts[0]!.payload.name).not.toContain('..');
      expect(artifacts[0]!.payload.name).not.toContain('/');
    });
  });

  describe('onEnd', () => {
    it.each([
      ['passed', RunStatus.Passed],
      ['failed', RunStatus.Failed],
      ['timedout', RunStatus.Failed],
      ['interrupted', RunStatus.Cancelled],
    ] as const)('maps FullResult status "%s" to %s', async (pwStatus, expected) => {
      const root = makeSuite('', [makeSuite('project')]);
      await reporter.onBegin({} as FullConfig, root);
      await flushQueue();
      mockSendEvent.mockClear();

      await reporter.onEnd({ status: pwStatus } as FullResult);

      const events = sentEvents();
      const runEnd = events.find((e) => e.eventType === 'run.end');
      expect(runEnd!.payload.status).toBe(expected);
    });

    it('waits for all pending events and logs summary', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const root = makeSuite('', [makeSuite('project')]);
      await reporter.onBegin({} as FullConfig, root);

      await reporter.onEnd({ status: 'passed' } as FullResult);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[assertly] Run complete:'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('retries'));
    });

    it('does nothing when disabled', async () => {
      const r = new AssertlyReporter({ ...makeConfig(), enabled: false });
      mockSendEvent.mockClear();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await r.onEnd({ status: 'passed' } as FullResult);

      expect(mockSendEvent).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});

function sentEvents(): V1Event[] {
  return mockSendEvent.mock.calls.map((call: [V1Event]) => call[0]);
}
