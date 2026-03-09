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
import type { ArtifactId } from '@assertly/shared-types';
import type { RunId, SuiteId, TestId } from '@assertly/shared-types';
import type {
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
  Reporter,
} from '@playwright/test/reporter';

import { detectCi } from './ci-detect.js';
import { AssertlyClient } from './client.js';
import type { AssertlyReporterConfig } from './types.js';

const MAX_ERROR_MESSAGE_LENGTH = 10_000;
const MAX_STACK_TRACE_LENGTH = 50_000;
const ARTIFACT_SIZE_LIMIT = 10 * 1024 * 1024;
const ARTIFACT_SIZE_WARNING = 5 * 1024 * 1024;
const MAX_QUEUE_SIZE = 10_000;

interface ResolvedConfig {
  apiUrl: string;
  projectToken: string;
  enabled: boolean;
  timeout: number;
  captureArtifacts: boolean;
  maxRetries: number;
  flushTimeout: number;
  failOnConnectionError: boolean;
  metadata: Record<string, unknown>;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1';
}

function resolveConfig(config: AssertlyReporterConfig): ResolvedConfig {
  const apiUrl = config.apiUrl ?? process.env.ASSERTLY_API_URL;
  const projectToken = config.projectToken ?? process.env.ASSERTLY_PROJECT_TOKEN;
  const enabled = config.enabled ?? parseBoolean(process.env.ASSERTLY_ENABLED, true);

  const base = {
    timeout: config.timeout ?? 30_000,
    captureArtifacts: config.captureArtifacts ?? true,
    maxRetries: config.maxRetries ?? 3,
    flushTimeout: config.flushTimeout ?? 30_000,
    failOnConnectionError: config.failOnConnectionError ?? false,
    metadata: config.metadata ?? {},
  };

  if (!apiUrl || !projectToken) {
    if (enabled) {
      console.warn(
        '[assertly] Reporter disabled: missing apiUrl or projectToken. ' +
          'Set ASSERTLY_API_URL and ASSERTLY_PROJECT_TOKEN env vars, or pass them in reporter config.',
      );
    }
    return { ...base, apiUrl: '', projectToken: '', enabled: false };
  }

  return { ...base, apiUrl, projectToken, enabled };
}

export default class AssertlyReporter implements Reporter {
  private readonly config: ResolvedConfig;
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

  constructor(config: AssertlyReporterConfig = {}) {
    this.config = resolveConfig(config);
    this.client = new AssertlyClient(
      this.config.apiUrl,
      this.config.projectToken,
      this.config.timeout,
      this.config.maxRetries,
    );
  }

  get isEnabled(): boolean {
    return this.config.enabled;
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
    const ci = detectCi();

    this.enqueue({
      version: '1',
      timestamp: new Date().toISOString(),
      runId: this.runId,
      eventType: 'run.start',
      payload: {
        runName,
        ...(ci ? { ci } : {}),
        ...(Object.keys(this.config.metadata).length > 0 ? { metadata: this.config.metadata } : {}),
      },
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
    this.artifactPromises.push(
      this.processArtifacts(entry.testId, result.attachments, result.retry),
    );
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

      const attempts = entry.attempts.map((attempt) => ({
        retryIndex: attempt.retry,
        status: mapTestStatus(attempt.status),
        durationMs: attempt.duration,
        startedAt: attempt.startTime.toISOString(),
        finishedAt: new Date(attempt.startTime.getTime() + attempt.duration).toISOString(),
        errorMessage: attempt.error?.message?.slice(0, MAX_ERROR_MESSAGE_LENGTH),
        stackTrace: attempt.error?.stack?.slice(0, MAX_STACK_TRACE_LENGTH),
      }));

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
          attempts,
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

  private walkSuites(suite: Suite, depth: number = 0, parentSuiteId?: SuiteId): void {
    for (const child of suite.suites) {
      // Depth 0 = root's children (project suites) - skip sending, recurse with same parent
      if (depth === 0) {
        this.walkSuites(child, depth + 1, undefined); // Test files become roots
      } else {
        // Depth 1+ = test files and describe blocks - send normally
        const suiteId = asSuiteId(crypto.randomUUID());
        this.suiteMap.set(child, suiteId);

        this.enqueue({
          version: '1',
          timestamp: new Date().toISOString(),
          runId: this.runId,
          eventType: 'suite.start',
          payload: { suiteId, suiteName: child.title, parentSuiteId },
        });

        this.walkSuites(child, depth + 1, suiteId);
      }
    }
  }

  private async processArtifacts(
    testId: TestId,
    attachments: TestResult['attachments'],
    retryIndex: number,
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

      const contentType = attachment.contentType ?? 'application/octet-stream';
      const name = sanitizeArtifactName(attachment.name);

      const presign = await this.client.presignArtifact({
        runId: this.runId,
        testId,
        fileName: name,
        contentType,
        sizeBytes: buffer.length,
      });

      if (!presign) {
        console.warn(`[assertly] Failed to get presigned URL for artifact "${attachment.name}"`);
        continue;
      }

      const uploaded = await this.client.uploadToPresignedUrl(
        presign.uploadUrl,
        buffer,
        contentType,
      );
      if (!uploaded) {
        console.warn(`[assertly] Failed to upload artifact "${attachment.name}" to S3`);
        continue;
      }

      const artifactType = mapContentTypeToArtifactType(attachment.contentType);

      this.enqueue({
        version: '1',
        timestamp: new Date().toISOString(),
        runId: this.runId,
        eventType: 'artifact.upload',
        payload: {
          artifactId: presign.artifactId as ArtifactId,
          testId,
          artifactType,
          name,
          storagePath: presign.storagePath,
          mimeType: attachment.contentType,
          retryIndex,
        },
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
