import type { V1Event } from '@assertly/reporter-core-protocol';
import { RunStatus, TestStatus } from '@assertly/shared-types';
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

const mockSendEvent = vi.fn().mockResolvedValue({ ok: true, eventId: 'evt-1' });

vi.mock('../src/client.js', () => {
  return {
    AssertlyClient: class MockAssertlyClient {
      sendEvent = mockSendEvent;
    },
  };
});

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
  // Wire parent references for children
  for (const child of children) {
    (child as { parent: Suite }).parent = suite;
  }
  for (const test of tests) {
    (test as { parent: Suite }).parent = suite;
  }
  return suite;
}

function makeTest(title: string, parent?: Suite): TestCase {
  return { title, parent } as unknown as TestCase;
}

function makeTestResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    status: 'passed',
    duration: 150,
    retry: 0,
    error: undefined,
    ...overrides,
  } as unknown as TestResult;
}

describe('AssertlyReporter', () => {
  let reporter: AssertlyReporter;

  beforeEach(() => {
    mockSendEvent.mockClear();
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
    it('sends run.start with project suite title', () => {
      const projectSuite = makeSuite('my-project');
      const rootSuite = makeSuite('', [projectSuite]);

      reporter.onBegin({} as FullConfig, rootSuite);

      const events = sentEvents();
      const runStart = events.find((e) => e.eventType === 'run.start');
      expect(runStart).toBeDefined();
      expect(runStart!.payload.runName).toBe('my-project');
    });

    it('falls back to "Playwright Run" when no project suite', () => {
      const rootSuite = makeSuite('', []);

      reporter.onBegin({} as FullConfig, rootSuite);

      const events = sentEvents();
      const runStart = events.find((e) => e.eventType === 'run.start');
      expect(runStart!.payload.runName).toBe('Playwright Run');
    });

    it('sends suite.start for each child suite with parent relationships', () => {
      const grandchild = makeSuite('grandchild');
      const child = makeSuite('child', [grandchild]);
      const root = makeSuite('', [child]);

      reporter.onBegin({} as FullConfig, root);

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

    it('does nothing when disabled', () => {
      const r = new AssertlyReporter({ ...makeConfig(), enabled: false });
      mockSendEvent.mockClear();
      r.onBegin({} as FullConfig, makeSuite(''));
      expect(mockSendEvent).not.toHaveBeenCalled();
    });
  });

  describe('onTestEnd', () => {
    it('sends test.start and test.end for a passed test', () => {
      const child = makeSuite('my-suite');
      const root = makeSuite('', [child]);
      reporter.onBegin({} as FullConfig, root);
      mockSendEvent.mockClear();

      const test = makeTest('should pass', child);
      reporter.onTestEnd(test, makeTestResult({ status: 'passed', duration: 200 }));

      const events = sentEvents();
      expect(events).toHaveLength(2);
      expect(events[0]!.eventType).toBe('test.start');
      expect(events[0]!.payload.testName).toBe('should pass');
      expect(events[1]!.eventType).toBe('test.end');
      expect(events[1]!.payload.status).toBe(TestStatus.Passed);
      expect(events[1]!.payload.durationMs).toBe(200);
    });

    it.each([
      ['failed', TestStatus.Failed],
      ['timedOut', TestStatus.Failed],
      ['interrupted', TestStatus.Failed],
      ['skipped', TestStatus.Skipped],
    ] as const)('maps Playwright status "%s" to %s', (pwStatus, expected) => {
      const child = makeSuite('suite');
      const root = makeSuite('', [child]);
      reporter.onBegin({} as FullConfig, root);
      mockSendEvent.mockClear();

      const test = makeTest('test', child);
      reporter.onTestEnd(test, makeTestResult({ status: pwStatus }));

      const events = sentEvents();
      expect(events[1]!.payload.status).toBe(expected);
    });

    it('truncates error message and stack trace', () => {
      const child = makeSuite('suite');
      const root = makeSuite('', [child]);
      reporter.onBegin({} as FullConfig, root);
      mockSendEvent.mockClear();

      const longMessage = 'x'.repeat(20_000);
      const longStack = 'y'.repeat(100_000);
      const test = makeTest('test', child);
      reporter.onTestEnd(
        test,
        makeTestResult({
          status: 'failed',
          error: { message: longMessage, stack: longStack } as TestResult['error'],
        }),
      );

      const events = sentEvents();
      const testEnd = events[1]!;
      expect(testEnd.payload.errorMessage.length).toBe(10_000);
      expect(testEnd.payload.stackTrace.length).toBe(50_000);
    });

    it('includes retryCount from result', () => {
      const child = makeSuite('suite');
      const root = makeSuite('', [child]);
      reporter.onBegin({} as FullConfig, root);
      mockSendEvent.mockClear();

      const test = makeTest('test', child);
      reporter.onTestEnd(test, makeTestResult({ retry: 2 }));

      const events = sentEvents();
      expect(events[1]!.payload.retryCount).toBe(2);
    });

    it('does nothing when disabled', () => {
      const r = new AssertlyReporter({ ...makeConfig(), enabled: false });
      mockSendEvent.mockClear();
      r.onTestEnd(makeTest('test'), makeTestResult());
      expect(mockSendEvent).not.toHaveBeenCalled();
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
      reporter.onBegin({} as FullConfig, root);
      mockSendEvent.mockClear();

      await reporter.onEnd({ status: pwStatus } as FullResult);

      const events = sentEvents();
      const runEnd = events.find((e) => e.eventType === 'run.end');
      expect(runEnd!.payload.status).toBe(expected);
    });

    it('waits for all pending events and logs summary', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const root = makeSuite('', [makeSuite('project')]);
      reporter.onBegin({} as FullConfig, root);

      await reporter.onEnd({ status: 'passed' } as FullResult);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[assertly] Run complete:'));
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
