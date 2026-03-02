import crypto from 'node:crypto';

import type { V1Event } from '@assertly/reporter-core-protocol';
import { RunStatus, TestStatus, asRunId, asSuiteId, asTestId } from '@assertly/shared-types';
import type { RunId, SuiteId } from '@assertly/shared-types';
import type {
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
  Reporter,
} from '@playwright/test/reporter';

import { AssertlyClient } from './client.js';
import type { SendEventResult } from './client.js';
import type { AssertlyReporterConfig } from './types.js';

const MAX_ERROR_MESSAGE_LENGTH = 10_000;
const MAX_STACK_TRACE_LENGTH = 50_000;

export default class AssertlyReporter implements Reporter {
  private readonly config: AssertlyReporterConfig;
  private readonly client: AssertlyClient;
  private runId!: RunId;
  private readonly suiteMap = new Map<Suite, SuiteId>();
  private readonly pendingEvents: Promise<SendEventResult>[] = [];
  private eventsSent = 0;
  private eventsFailed = 0;

  constructor(config: AssertlyReporterConfig) {
    this.config = { enabled: true, timeout: 30_000, ...config };
    this.client = new AssertlyClient(
      this.config.apiUrl,
      this.config.projectToken,
      this.config.timeout,
    );
  }

  get isEnabled(): boolean {
    return this.config.enabled ?? true;
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    if (!this.isEnabled) return;

    this.runId = asRunId(crypto.randomUUID());
    const runName = suite.suites[0]?.title || 'Playwright Run';

    this.send({
      version: '1',
      timestamp: new Date().toISOString(),
      runId: this.runId,
      eventType: 'run.start',
      payload: { runName },
    });

    this.walkSuites(suite);
  }

  onTestBegin(_test: TestCase): void {
    // test.start is sent together with test.end in onTestEnd
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (!this.isEnabled) return;

    const testId = asTestId(crypto.randomUUID());
    const suiteId = this.suiteMap.get(test.parent) ?? asSuiteId(crypto.randomUUID());
    const status = mapTestStatus(result.status);

    this.send({
      version: '1',
      timestamp: new Date().toISOString(),
      runId: this.runId,
      eventType: 'test.start',
      payload: { testId, suiteId, testName: test.title },
    });

    const errorMessage = result.error?.message?.slice(0, MAX_ERROR_MESSAGE_LENGTH);
    const stackTrace = result.error?.stack?.slice(0, MAX_STACK_TRACE_LENGTH);

    this.send({
      version: '1',
      timestamp: new Date().toISOString(),
      runId: this.runId,
      eventType: 'test.end',
      payload: {
        testId,
        status,
        durationMs: result.duration,
        errorMessage,
        stackTrace,
        retryCount: result.retry,
      },
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    if (!this.isEnabled) return;

    const status = mapRunStatus(result.status);

    this.send({
      version: '1',
      timestamp: new Date().toISOString(),
      runId: this.runId,
      eventType: 'run.end',
      payload: { status },
    });

    await Promise.allSettled(this.pendingEvents);

    console.warn(
      `[assertly] Run complete: ${this.eventsSent} events sent, ${this.eventsFailed} failed`,
    );
  }

  private walkSuites(suite: Suite, parentSuiteId?: SuiteId): void {
    for (const child of suite.suites) {
      const suiteId = asSuiteId(crypto.randomUUID());
      this.suiteMap.set(child, suiteId);

      this.send({
        version: '1',
        timestamp: new Date().toISOString(),
        runId: this.runId,
        eventType: 'suite.start',
        payload: { suiteId, suiteName: child.title, parentSuiteId },
      });

      this.walkSuites(child, suiteId);
    }
  }

  private send(event: V1Event): void {
    const promise = this.client.sendEvent(event).then((result) => {
      if (result.ok) {
        this.eventsSent++;
      } else {
        this.eventsFailed++;
      }
      return result;
    });
    this.pendingEvents.push(promise);
  }
}

function mapTestStatus(status: TestResult['status']): TestStatus {
  switch (status) {
    case 'passed':
      return TestStatus.Passed;
    case 'failed':
    case 'timedOut':
    case 'interrupted':
      return TestStatus.Failed;
    case 'skipped':
      return TestStatus.Skipped;
  }
}

function mapRunStatus(status: FullResult['status']): RunStatus {
  switch (status) {
    case 'passed':
      return RunStatus.Passed;
    case 'failed':
    case 'timedout':
      return RunStatus.Failed;
    case 'interrupted':
      return RunStatus.Cancelled;
  }
}

export type { AssertlyReporterConfig } from './types.js';
