import type {
  FullConfig,
  FullResult,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import type { V1Event } from '@spechive/reporter-core-protocol';
import { ArtifactType, RunStatus, TestStatus } from '@spechive/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SpecHiveReporter from '../src/index.js';
import type { SpecHiveReporterConfig } from '../src/types.js';

const {
  mockSendEvent,
  mockCheckHealth,
  mockReadFile,
  mockPresignArtifact,
  mockUploadToPresignedUrl,
} = vi.hoisted(() => ({
  mockSendEvent: vi.fn().mockResolvedValue({ ok: true, eventId: 'evt-1', retries: 0 }),
  mockCheckHealth: vi.fn().mockResolvedValue(true),
  mockReadFile: vi.fn(),
  mockPresignArtifact: vi.fn().mockResolvedValue({
    artifactId: '00000000-0000-7000-8000-000000000099',
    storagePath: 'org/proj/run/test/artifact.png',
    uploadUrl: 'https://s3.example.com/presigned',
    expiresIn: 300,
  }),
  mockUploadToPresignedUrl: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/client.js', () => {
  return {
    SpecHiveClient: class MockSpecHiveClient {
      sendEvent = mockSendEvent;
      checkHealth = mockCheckHealth;
      presignArtifact = mockPresignArtifact;
      uploadToPresignedUrl = mockUploadToPresignedUrl;
    },
  };
});

vi.mock('node:fs/promises', () => ({ readFile: mockReadFile }));

function makeConfig(): SpecHiveReporterConfig {
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
    startTime: new Date('2026-01-01T00:00:00Z'),
    error: undefined,
    attachments: [],
    ...overrides,
  } as unknown as TestResult;
}

function mockOutcome(test: TestCase, outcome: string): void {
  (test as { outcome: () => string }).outcome = () => outcome;
}

async function flushQueue(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe('SpecHiveReporter', () => {
  let reporter: SpecHiveReporter;

  beforeEach(() => {
    mockSendEvent.mockClear();
    mockCheckHealth.mockClear();
    mockReadFile.mockReset();
    reporter = new SpecHiveReporter(makeConfig());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('defaults enabled to true', () => {
      expect(reporter.isEnabled).toBe(true);
    });

    it('respects enabled: false', () => {
      const r = new SpecHiveReporter({ ...makeConfig(), enabled: false });
      expect(r.isEnabled).toBe(false);
    });
  });

  describe('onBegin', () => {
    it('sends run.start with Playwright prefix and project suite title', async () => {
      const projectSuite = makeSuite('my-project');
      const rootSuite = makeSuite('', [projectSuite]);

      await reporter.onBegin({} as FullConfig, rootSuite);
      await flushQueue();

      const events = sentEvents();
      const runStart = events.find((e) => e.eventType === 'run.start');
      expect(runStart).toBeDefined();
      expect(runStart!.payload.runName).toBe('Playwright · my-project');
    });

    it('defaults to "Playwright" when no project suite exists', async () => {
      const rootSuite = makeSuite('', []);

      await reporter.onBegin({} as FullConfig, rootSuite);
      await flushQueue();

      const events = sentEvents();
      const runStart = events.find((e) => e.eventType === 'run.start');
      expect(runStart!.payload.runName).toBe('Playwright');
    });

    it('joins multiple non-empty project titles', async () => {
      const root = makeSuite('', [
        makeSuite('chromium'),
        makeSuite('firefox'),
        makeSuite('webkit'),
      ]);

      await reporter.onBegin({} as FullConfig, root);
      await flushQueue();

      const events = sentEvents();
      const runStart = events.find((e) => e.eventType === 'run.start');
      expect(runStart!.payload.runName).toBe('Playwright · chromium, firefox, webkit');
    });

    it('skips empty project titles when joining', async () => {
      const root = makeSuite('', [makeSuite(''), makeSuite('chromium')]);

      await reporter.onBegin({} as FullConfig, root);
      await flushQueue();

      const events = sentEvents();
      const runStart = events.find((e) => e.eventType === 'run.start');
      expect(runStart!.payload.runName).toBe('Playwright · chromium');
    });

    it('uses config runName over auto-derived name', async () => {
      const r = new SpecHiveReporter({ ...makeConfig(), runName: 'Nightly E2E' });
      const root = makeSuite('', [makeSuite('chromium')]);

      await r.onBegin({} as FullConfig, root);
      await flushQueue();

      const events = sentEvents();
      const runStart = events.find((e) => e.eventType === 'run.start');
      expect(runStart!.payload.runName).toBe('Nightly E2E');
    });

    it('skips project suite and makes test files root level', async () => {
      // Playwright hierarchy: root -> project suite -> test file -> describe block
      const describeBlock = makeSuite('describe block');
      const testFile = makeSuite('tests/auth.spec.ts', [describeBlock]);
      const projectSuite = makeSuite('my-project', [testFile]);
      const root = makeSuite('', [projectSuite]);

      await reporter.onBegin({} as FullConfig, root);
      await flushQueue();

      const events = sentEvents();
      const suiteEvents = events.filter((e) => e.eventType === 'suite.start');
      expect(suiteEvents).toHaveLength(2); // Project suite is skipped

      // Test file becomes root (no parentSuiteId)
      const testFileEvent = suiteEvents[0]!;
      expect(testFileEvent.payload.suiteName).toBe('tests/auth.spec.ts');
      expect(testFileEvent.payload.parentSuiteId).toBeUndefined();

      // Describe block is nested under test file
      const describeEvent = suiteEvents[1]!;
      expect(describeEvent.payload.suiteName).toBe('describe block');
      expect(describeEvent.payload.parentSuiteId).toBe(testFileEvent.payload.suiteId);
    });

    it('does nothing when disabled', async () => {
      const r = new SpecHiveReporter({ ...makeConfig(), enabled: false });
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
      const r = new SpecHiveReporter({ ...makeConfig(), failOnConnectionError: true });
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
      mockOutcome(test, pwStatus === 'skipped' ? 'skipped' : 'unexpected');
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
      mockOutcome(test, 'unexpected');
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

    it('always includes attempts array in test.end even for single-attempt tests', async () => {
      const child = makeSuite('suite');
      const root = makeSuite('', [child]);
      await reporter.onBegin({} as FullConfig, root);
      await flushQueue();
      mockSendEvent.mockClear();

      const test = makeTest('test', child);
      reporter.onTestEnd(test, makeTestResult({ status: 'passed', duration: 150, retry: 0 }));
      await reporter.onEnd({ status: 'passed' } as FullResult);

      const events = sentEvents();
      const testEnd = events.find((e) => e.eventType === 'test.end');
      expect(testEnd!.payload.attempts).toBeDefined();
      expect(testEnd!.payload.attempts).toHaveLength(1);
      expect(testEnd!.payload.attempts[0]).toEqual(
        expect.objectContaining({
          retryIndex: 0,
          status: TestStatus.Passed,
          durationMs: 150,
          startedAt: expect.any(String),
          finishedAt: expect.any(String),
          errorMessage: undefined,
          stackTrace: undefined,
        }),
      );
    });

    it('includes per-attempt data in attempts array for retried test', async () => {
      const child = makeSuite('suite');
      const root = makeSuite('', [child]);
      await reporter.onBegin({} as FullConfig, root);
      await flushQueue();
      mockSendEvent.mockClear();

      const test = makeTest('test', child);
      mockOutcome(test, 'flaky');
      reporter.onTestEnd(
        test,
        makeTestResult({
          status: 'failed',
          retry: 0,
          duration: 100,
          error: { message: 'fail 1', stack: 'stack-1' } as TestResult['error'],
        }),
      );
      reporter.onTestEnd(test, makeTestResult({ status: 'passed', retry: 1, duration: 200 }));
      await reporter.onEnd({ status: 'passed' } as FullResult);

      const events = sentEvents();
      const testEnd = events.find((e) => e.eventType === 'test.end');
      expect(testEnd!.payload.attempts).toHaveLength(2);
      expect(testEnd!.payload.attempts[0]).toEqual(
        expect.objectContaining({
          retryIndex: 0,
          status: TestStatus.Failed,
          durationMs: 100,
          startedAt: expect.any(String),
          finishedAt: expect.any(String),
          errorMessage: 'fail 1',
          stackTrace: 'stack-1',
        }),
      );
      expect(testEnd!.payload.attempts[1]).toEqual(
        expect.objectContaining({
          retryIndex: 1,
          status: TestStatus.Passed,
          durationMs: 200,
          startedAt: expect.any(String),
          finishedAt: expect.any(String),
          errorMessage: undefined,
          stackTrace: undefined,
        }),
      );
    });

    it('does nothing when disabled', async () => {
      const r = new SpecHiveReporter({ ...makeConfig(), enabled: false });
      mockSendEvent.mockClear();
      r.onTestEnd(makeTest('test'), makeTestResult());
      expect(mockSendEvent).not.toHaveBeenCalled();
    });
  });

  describe('flaky detection', () => {
    async function beginReporter(): Promise<{ reporter: SpecHiveReporter; suite: Suite }> {
      const r = new SpecHiveReporter(makeConfig());
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
      mockOutcome(test, 'unexpected');

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
      mockOutcome(test, 'flaky');

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
      mockOutcome(test, 'flaky');

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
      mockOutcome(test, 'flaky');

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
      config?: Partial<SpecHiveReporterConfig>,
    ): Promise<SpecHiveReporter> {
      const r = new SpecHiveReporter({ ...makeConfig(), ...config });
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
      expect(artifacts[0]!.payload.artifactId).toBe('00000000-0000-7000-8000-000000000099');
      expect(artifacts[0]!.payload.storagePath).toBe('org/proj/run/test/artifact.png');
      expect(artifacts[0]!.payload.artifactType).toBe(ArtifactType.Screenshot);
      expect(artifacts[0]!.payload.name).toBe('screenshot.png');
      expect(artifacts[0]!.payload.mimeType).toBe('image/png');
      expect(artifacts[0]!.payload.retryIndex).toBe(0);
      expect(mockPresignArtifact).toHaveBeenCalled();
      expect(mockUploadToPresignedUrl).toHaveBeenCalledWith(
        'https://s3.example.com/presigned',
        content,
        'image/png',
      );
    });

    it('includes retryIndex from the test attempt in artifact.upload event', async () => {
      const r = await setupReporter();
      mockReadFile.mockResolvedValue(Buffer.from('data'));

      const test = makeTest('test');
      mockOutcome(test, 'flaky');

      // First attempt (retry 0) — no artifacts
      r.onTestEnd(test, makeTestResult({ status: 'failed', retry: 0 }));

      // Second attempt (retry 1) — with artifact
      r.onTestEnd(
        test,
        makeTestResult({
          status: 'passed',
          retry: 1,
          attachments: [
            { name: 'screenshot.png', contentType: 'image/png', path: '/tmp/screenshot.png' },
          ],
        }),
      );
      await r.onEnd({ status: 'passed' } as FullResult);

      const artifacts = collectArtifactEvents();
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]!.payload.retryIndex).toBe(1);
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
      expect(artifacts[0]!.payload.storagePath).toBeDefined();
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

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[spechive] Run complete:'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('retries'));
    });

    it('does nothing when disabled', async () => {
      const r = new SpecHiveReporter({ ...makeConfig(), enabled: false });
      mockSendEvent.mockClear();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await r.onEnd({ status: 'passed' } as FullResult);

      expect(mockSendEvent).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('config resolution', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('picks up apiUrl and projectToken from env vars', async () => {
      vi.stubEnv('SPECHIVE_API_URL', 'https://env-api.test');
      vi.stubEnv('SPECHIVE_PROJECT_TOKEN', 'env-tok-456');

      const r = new SpecHiveReporter();
      expect(r.isEnabled).toBe(true);

      const root = makeSuite('', [makeSuite('project')]);
      await r.onBegin({} as FullConfig, root);
      await flushQueue();

      expect(mockCheckHealth).toHaveBeenCalledOnce();
      expect(sentEvents().some((e) => e.eventType === 'run.start')).toBe(true);
    });

    it('inline config overrides env vars', () => {
      vi.stubEnv('SPECHIVE_API_URL', 'https://env-api.test');
      vi.stubEnv('SPECHIVE_PROJECT_TOKEN', 'env-tok');

      const r = new SpecHiveReporter({ apiUrl: 'https://inline.test', projectToken: 'inline-tok' });
      expect(r.isEnabled).toBe(true);
    });

    it('defaults apiUrl to cloud URL when only projectToken is set', () => {
      vi.stubEnv('SPECHIVE_PROJECT_TOKEN', 'tok-123');

      const r = new SpecHiveReporter();

      expect(r.isEnabled).toBe(true);
      expect(r.apiUrl).toBe('https://api.spechive.dev');
    });

    it('auto-disables with warning when projectToken is missing', () => {
      vi.stubEnv('SPECHIVE_API_URL', 'https://api.test');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const r = new SpecHiveReporter();

      expect(r.isEnabled).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('missing projectToken'));
    });

    it('auto-disables silently when both are missing and enabled is false', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const r = new SpecHiveReporter({ enabled: false });

      expect(r.isEnabled).toBe(false);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('SPECHIVE_ENABLED=false disables reporter', () => {
      vi.stubEnv('SPECHIVE_API_URL', 'https://api.test');
      vi.stubEnv('SPECHIVE_PROJECT_TOKEN', 'tok-123');
      vi.stubEnv('SPECHIVE_ENABLED', 'false');

      const r = new SpecHiveReporter();
      expect(r.isEnabled).toBe(false);
    });

    it('SPECHIVE_ENABLED=0 disables reporter', () => {
      vi.stubEnv('SPECHIVE_API_URL', 'https://api.test');
      vi.stubEnv('SPECHIVE_PROJECT_TOKEN', 'tok-123');
      vi.stubEnv('SPECHIVE_ENABLED', '0');

      const r = new SpecHiveReporter();
      expect(r.isEnabled).toBe(false);
    });

    it('SPECHIVE_ENABLED=true keeps reporter enabled', () => {
      vi.stubEnv('SPECHIVE_API_URL', 'https://api.test');
      vi.stubEnv('SPECHIVE_PROJECT_TOKEN', 'tok-123');
      vi.stubEnv('SPECHIVE_ENABLED', 'true');

      const r = new SpecHiveReporter();
      expect(r.isEnabled).toBe(true);
    });

    it('SPECHIVE_ENABLED=1 keeps reporter enabled', () => {
      vi.stubEnv('SPECHIVE_API_URL', 'https://api.test');
      vi.stubEnv('SPECHIVE_PROJECT_TOKEN', 'tok-123');
      vi.stubEnv('SPECHIVE_ENABLED', '1');

      const r = new SpecHiveReporter();
      expect(r.isEnabled).toBe(true);
    });

    it('SPECHIVE_ENABLED is case-insensitive', () => {
      vi.stubEnv('SPECHIVE_API_URL', 'https://api.test');
      vi.stubEnv('SPECHIVE_PROJECT_TOKEN', 'tok-123');
      vi.stubEnv('SPECHIVE_ENABLED', 'TRUE');

      const r = new SpecHiveReporter();
      expect(r.isEnabled).toBe(true);
    });

    it('falls back to cloud URL when SPECHIVE_API_URL is empty string', () => {
      vi.stubEnv('SPECHIVE_API_URL', '');
      vi.stubEnv('SPECHIVE_PROJECT_TOKEN', 'tok-123');

      const r = new SpecHiveReporter();

      expect(r.isEnabled).toBe(true);
      expect(r.apiUrl).toBe('https://api.spechive.dev');
    });

    it('SPECHIVE_ENABLED with whitespace is trimmed', () => {
      vi.stubEnv('SPECHIVE_API_URL', 'https://api.test');
      vi.stubEnv('SPECHIVE_PROJECT_TOKEN', 'tok-123');
      vi.stubEnv('SPECHIVE_ENABLED', ' true ');

      const r = new SpecHiveReporter();
      expect(r.isEnabled).toBe(true);
    });

    it('SPECHIVE_RUN_NAME env var sets run name', async () => {
      vi.stubEnv('SPECHIVE_RUN_NAME', 'CI Deploy Tests');

      const r = new SpecHiveReporter(makeConfig());
      const root = makeSuite('', [makeSuite('chromium')]);

      await r.onBegin({} as FullConfig, root);
      await flushQueue();

      const events = sentEvents();
      const runStart = events.find((e) => e.eventType === 'run.start');
      expect(runStart!.payload.runName).toBe('CI Deploy Tests');
    });

    it('config runName takes priority over SPECHIVE_RUN_NAME env var', async () => {
      vi.stubEnv('SPECHIVE_RUN_NAME', 'From Env');

      const r = new SpecHiveReporter({ ...makeConfig(), runName: 'From Config' });
      const root = makeSuite('', [makeSuite('chromium')]);

      await r.onBegin({} as FullConfig, root);
      await flushQueue();

      const events = sentEvents();
      const runStart = events.find((e) => e.eventType === 'run.start');
      expect(runStart!.payload.runName).toBe('From Config');
    });
  });

  describe('CI metadata in run.start', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('includes CI info when in CI environment', async () => {
      vi.stubEnv('GITHUB_ACTIONS', 'true');
      vi.stubEnv('GITHUB_REF_NAME', 'main');
      vi.stubEnv('GITHUB_SHA', 'abc1234567890def1234567890abcdef12345678');
      vi.stubEnv('GITHUB_SERVER_URL', 'https://github.com');
      vi.stubEnv('GITHUB_REPOSITORY', 'org/repo');
      vi.stubEnv('GITHUB_RUN_ID', '12345');

      const r = new SpecHiveReporter(makeConfig());
      const root = makeSuite('', [makeSuite('project')]);
      await r.onBegin({} as FullConfig, root);
      await flushQueue();

      const events = sentEvents();
      const runStart = events.find((e) => e.eventType === 'run.start');
      expect(runStart).toBeDefined();
      expect(runStart!.payload).toHaveProperty('ci');
      const ci = (runStart!.payload as { ci?: Record<string, unknown> }).ci;
      expect(ci).toEqual(
        expect.objectContaining({
          branch: 'main',
          commitSha: 'abc1234567890def1234567890abcdef12345678',
          ciProvider: 'github-actions',
        }),
      );
    });

    it('includes user metadata when config.metadata is set', async () => {
      const r = new SpecHiveReporter({
        ...makeConfig(),
        metadata: { environment: 'staging', version: '1.2.3' },
      });
      const root = makeSuite('', [makeSuite('project')]);
      await r.onBegin({} as FullConfig, root);
      await flushQueue();

      const events = sentEvents();
      const runStart = events.find((e) => e.eventType === 'run.start');
      expect(runStart!.payload).toHaveProperty('metadata');
      const metadata = (runStart!.payload as { metadata?: Record<string, unknown> }).metadata;
      expect(metadata).toEqual({ environment: 'staging', version: '1.2.3' });
    });

    it('does not include metadata key when config.metadata is empty', async () => {
      const r = new SpecHiveReporter(makeConfig());
      const root = makeSuite('', [makeSuite('project')]);
      await r.onBegin({} as FullConfig, root);
      await flushQueue();

      const events = sentEvents();
      const runStart = events.find((e) => e.eventType === 'run.start');
      expect(runStart!.payload).not.toHaveProperty('metadata');
    });

    it('includes both CI and metadata when both present', async () => {
      vi.stubEnv('GITHUB_ACTIONS', 'true');
      vi.stubEnv('GITHUB_REF_NAME', 'develop');
      vi.stubEnv('GITHUB_SHA', 'def4567890abcdef1234567890abcdef12345678');
      vi.stubEnv('GITHUB_SERVER_URL', 'https://github.com');
      vi.stubEnv('GITHUB_REPOSITORY', 'org/repo');
      vi.stubEnv('GITHUB_RUN_ID', '99999');

      const r = new SpecHiveReporter({
        ...makeConfig(),
        metadata: { custom: 'value' },
      });
      const root = makeSuite('', [makeSuite('project')]);
      await r.onBegin({} as FullConfig, root);
      await flushQueue();

      const events = sentEvents();
      const runStart = events.find((e) => e.eventType === 'run.start');
      expect(runStart!.payload).toHaveProperty('ci');
      expect(runStart!.payload).toHaveProperty('metadata');
    });

    it('omits ci key when not in CI environment', async () => {
      // Ensure no CI env vars are set
      vi.stubEnv('CI', '');
      vi.stubEnv('GITHUB_ACTIONS', '');
      vi.stubEnv('GITLAB_CI', '');

      const r = new SpecHiveReporter(makeConfig());
      const root = makeSuite('', [makeSuite('project')]);
      await r.onBegin({} as FullConfig, root);
      await flushQueue();

      const events = sentEvents();
      const runStart = events.find((e) => e.eventType === 'run.start');
      expect(runStart!.payload).not.toHaveProperty('ci');
    });
  });
});

function sentEvents(): V1Event[] {
  return mockSendEvent.mock.calls.map((call: [V1Event]) => call[0]);
}
