import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';

import type { V1Event } from '@assertly/reporter-core-protocol';
import {
  ArtifactType,
  RunStatus,
  TestStatus,
  asRunId,
  asSuiteId,
  asTestId,
  sanitizeArtifactName,
} from '@assertly/shared-types';
import type { RunId, SuiteId, TestId } from '@assertly/shared-types';
import type {
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
  Reporter,
} from '@playwright/test/reporter';

import { AssertlyClient } from './client.js';
import type { AssertlyReporterConfig } from './types.js';

const MAX_ERROR_MESSAGE_LENGTH = 10_000;
const MAX_STACK_TRACE_LENGTH = 50_000;
const ARTIFACT_SIZE_LIMIT = 10 * 1024 * 1024;
const ARTIFACT_SIZE_WARNING = 5 * 1024 * 1024;
const MAX_QUEUE_SIZE = 10_000;

export default class AssertlyReporter implements Reporter {
  private readonly config: AssertlyReporterConfig;
  private readonly client: AssertlyClient;
  private runId!: RunId;
  private readonly suiteMap = new Map<Suite, SuiteId>();
  private readonly testTracker = new Map<
    string,
    {
      testId: TestId;
      suiteId: SuiteId;
      testName: string;
      testCase: TestCase;
      attempts: TestResult[];
    }
  >();
  private readonly queue: V1Event[] = [];
  private processing = false;
  private drainResolve: (() => void) | null = null;
  private readonly artifactPromises: Promise<void>[] = [];
  private eventsSent = 0;
  private eventsFailed = 0;
  private retriesTotal = 0;

  constructor(config: AssertlyReporterConfig) {
    this.config = {
      enabled: true,
      timeout: 30_000,
      captureArtifacts: true,
      maxRetries: 3,
      flushTimeout: 30_000,
      failOnConnectionError: false,
      ...config,
    };
    this.client = new AssertlyClient(
      this.config.apiUrl,
      this.config.projectToken,
      this.config.timeout,
      this.config.maxRetries,
    );
  }

  get isEnabled(): boolean {
    return this.config.enabled ?? true;
  }

  async onBegin(_config: FullConfig, suite: Suite): Promise<void> {
    if (!this.isEnabled) return;

    const healthy = await this.client.checkHealth();
    if (!healthy) {
      if (this.config.failOnConnectionError) {
        throw new Error(
          `[assertly] Cannot reach ${this.config.apiUrl}/health — aborting because failOnConnectionError is enabled`,
        );
      }
      console.warn(`[assertly] Cannot reach ${this.config.apiUrl}/health — events may be lost`);
    }

    this.runId = asRunId(crypto.randomUUID());
    const runName = suite.suites[0]?.title || 'Playwright Run';

    this.enqueue({
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

    const key = test.id;
    let entry = this.testTracker.get(key);

    if (!entry) {
      const testId = asTestId(crypto.randomUUID());
      const suiteId = this.suiteMap.get(test.parent) ?? asSuiteId(crypto.randomUUID());

      entry = { testId, suiteId, testName: test.title, testCase: test, attempts: [] };
      this.testTracker.set(key, entry);

      this.enqueue({
        version: '1',
        timestamp: new Date().toISOString(),
        runId: this.runId,
        eventType: 'test.start',
        payload: { testId, suiteId, testName: test.title },
      });
    }

    entry.attempts.push(result);
    this.artifactPromises.push(this.processArtifacts(entry.testId, result.attachments));
  }

  async onEnd(result: FullResult): Promise<void> {
    if (!this.isEnabled) return;

    this.flushTestResults();

    const status = mapRunStatus(result.status);

    this.enqueue({
      version: '1',
      timestamp: new Date().toISOString(),
      runId: this.runId,
      eventType: 'run.end',
      payload: { status },
    });

    await Promise.allSettled(this.artifactPromises);
    await this.waitForDrain();

    console.warn(
      `[assertly] Run complete: ${this.eventsSent} sent, ${this.eventsFailed} failed, ${this.retriesTotal} retries`,
    );
  }

  private flushTestResults(): void {
    for (const entry of this.testTracker.values()) {
      const finalAttempt = entry.attempts[entry.attempts.length - 1]!;
      const status = this.resolveTestStatus(entry);

      // For flaky tests, preserve the error from the last failed attempt
      const errorAttempt =
        status === TestStatus.Flaky
          ? [...entry.attempts].reverse().find((a) => a.status !== 'passed')
          : finalAttempt;

      const errorMessage = errorAttempt?.error?.message?.slice(0, MAX_ERROR_MESSAGE_LENGTH);
      const stackTrace = errorAttempt?.error?.stack?.slice(0, MAX_STACK_TRACE_LENGTH);

      this.enqueue({
        version: '1',
        timestamp: new Date().toISOString(),
        runId: this.runId,
        eventType: 'test.end',
        payload: {
          testId: entry.testId,
          status,
          durationMs: finalAttempt.duration,
          errorMessage,
          stackTrace,
          retryCount: finalAttempt.retry,
        },
      });
    }
  }

  private resolveTestStatus(entry: { testCase: TestCase; attempts: TestResult[] }): TestStatus {
    const outcome = entry.testCase.outcome();
    switch (outcome) {
      case 'flaky':
        return TestStatus.Flaky;
      case 'expected':
        return TestStatus.Passed;
      case 'unexpected':
        return TestStatus.Failed;
      case 'skipped':
        return TestStatus.Skipped;
      default: {
        // Fallback: final pass + any previous failure = flaky
        const finalAttempt = entry.attempts[entry.attempts.length - 1]!;
        if (finalAttempt.status === 'passed' && entry.attempts.some((a) => a.status !== 'passed')) {
          return TestStatus.Flaky;
        }
        return mapTestStatus(finalAttempt.status);
      }
    }
  }

  private walkSuites(suite: Suite, parentSuiteId?: SuiteId): void {
    for (const child of suite.suites) {
      const suiteId = asSuiteId(crypto.randomUUID());
      this.suiteMap.set(child, suiteId);

      this.enqueue({
        version: '1',
        timestamp: new Date().toISOString(),
        runId: this.runId,
        eventType: 'suite.start',
        payload: { suiteId, suiteName: child.title, parentSuiteId },
      });

      this.walkSuites(child, suiteId);
    }
  }

  private async processArtifacts(
    testId: TestId,
    attachments: TestResult['attachments'],
  ): Promise<void> {
    if (!this.config.captureArtifacts) return;

    for (const attachment of attachments) {
      let buffer: Buffer;

      if (attachment.path) {
        try {
          buffer = await readFile(attachment.path);
        } catch {
          continue;
        }
      } else if (attachment.body) {
        buffer = Buffer.from(attachment.body);
      } else {
        continue;
      }

      if (buffer.length > ARTIFACT_SIZE_LIMIT) {
        console.error(
          `[assertly] Skipping artifact "${attachment.name}" (${buffer.length} bytes exceeds ${ARTIFACT_SIZE_LIMIT} byte limit)`,
        );
        continue;
      }

      if (buffer.length > ARTIFACT_SIZE_WARNING) {
        console.warn(`[assertly] Large artifact "${attachment.name}" (${buffer.length} bytes)`);
      }

      const data = buffer.toString('base64');
      const artifactType = mapContentTypeToArtifactType(attachment.contentType);
      const name = sanitizeArtifactName(attachment.name);

      this.enqueue({
        version: '1',
        timestamp: new Date().toISOString(),
        runId: this.runId,
        eventType: 'artifact.upload',
        payload: { testId, artifactType, name, data, mimeType: attachment.contentType },
      });
    }
  }

  private enqueue(event: V1Event): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift();
      console.warn('[assertly] Event queue full — dropping oldest event');
    }
    this.queue.push(event);
    this.processQueue();
  }

  private processQueue(): void {
    if (this.processing) return;
    this.processing = true;
    void this.drainLoop();
  }

  private async drainLoop(): Promise<void> {
    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      const result = await this.client.sendEvent(event);
      if (result.ok) {
        this.eventsSent++;
      } else {
        this.eventsFailed++;
        console.warn(`[assertly] Event ${event.eventType} failed after retries`);
      }
      this.retriesTotal += result.retries ?? 0;
    }
    this.processing = false;
    if (this.drainResolve) {
      this.drainResolve();
      this.drainResolve = null;
    }
  }

  private waitForDrain(): Promise<void> {
    if (this.queue.length === 0 && !this.processing) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.drainResolve = resolve;

      const timeout = setTimeout(() => {
        const remaining = this.queue.length;
        if (remaining > 0) {
          console.warn(`[assertly] Flush timeout — ${remaining} events unsent`);
        }
        this.drainResolve = null;
        resolve();
      }, this.config.flushTimeout);

      // Avoid holding the process open
      if (typeof timeout === 'object' && 'unref' in timeout) {
        timeout.unref();
      }
    });
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

function mapContentTypeToArtifactType(contentType: string): ArtifactType {
  switch (contentType) {
    case 'image/png':
    case 'image/jpeg':
      return ArtifactType.Screenshot;
    case 'video/webm':
      return ArtifactType.Video;
    case 'application/zip':
      return ArtifactType.Trace;
    case 'text/plain':
      return ArtifactType.Log;
    default:
      return ArtifactType.Other;
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
