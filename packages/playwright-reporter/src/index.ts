import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';

import type {
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
  Reporter,
} from '@playwright/test/reporter';
import {
  SpecHiveClient,
  detectCi,
  resolveBaseConfig,
  ReporterQueue,
  MAX_ERROR_MESSAGE_LENGTH,
  MAX_STACK_TRACE_LENGTH,
} from '@spechive/reporter-client';
import type { BaseResolvedConfig } from '@spechive/reporter-client';
import {
  ArtifactType,
  RunStatus,
  TestStatus,
  asRunId,
  asSuiteId,
  asTestId,
  sanitizeArtifactName,
} from '@spechive/shared-types';
import type { ArtifactId } from '@spechive/shared-types';
import type { RunId, SuiteId, TestId } from '@spechive/shared-types';

import type { SpecHiveReporterConfig } from './types.js';

const ARTIFACT_SIZE_LIMIT = 10 * 1024 * 1024;
const ARTIFACT_SIZE_WARNING = 5 * 1024 * 1024;

interface PlaywrightResolvedConfig extends BaseResolvedConfig {
  captureArtifacts: boolean;
}

function resolveConfig(config: SpecHiveReporterConfig): PlaywrightResolvedConfig {
  return { ...resolveBaseConfig(config), captureArtifacts: config.captureArtifacts ?? true };
}

export default class SpecHiveReporter implements Reporter {
  private readonly config: PlaywrightResolvedConfig;
  private readonly client: SpecHiveClient;
  private readonly reporterQueue: ReporterQueue;
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
  private readonly artifactPromises: Promise<void>[] = [];

  constructor(config: SpecHiveReporterConfig = {}) {
    this.config = resolveConfig(config);
    this.client = new SpecHiveClient(
      this.config.apiUrl,
      this.config.projectToken,
      undefined,
      this.config.maxRetries,
    );
    this.reporterQueue = new ReporterQueue(this.client, {
      flushTimeout: this.config.flushTimeout,
    });
  }

  get isEnabled(): boolean {
    return this.config.enabled;
  }

  get apiUrl(): string {
    return this.config.apiUrl;
  }

  async onBegin(_config: FullConfig, suite: Suite): Promise<void> {
    if (!this.isEnabled) return;

    const healthy = await this.client.checkHealth();
    if (!healthy) {
      if (this.config.failOnConnectionError) {
        throw new Error(
          `[spechive] Cannot reach ${this.config.apiUrl}/health — aborting because failOnConnectionError is enabled`,
        );
      }
      console.warn(`[spechive] Cannot reach ${this.config.apiUrl}/health — events may be lost`);
    }

    this.runId = asRunId(crypto.randomUUID());
    const runName = this.config.runName ?? buildDefaultRunName(suite.suites);
    const ci = detectCi();

    this.reporterQueue.enqueue({
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

      this.reporterQueue.enqueue({
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

    this.reporterQueue.enqueue({
      version: '1',
      timestamp: new Date().toISOString(),
      runId: this.runId,
      eventType: 'run.end',
      payload: { status },
    });

    await Promise.allSettled(this.artifactPromises);
    await this.reporterQueue.waitForDrain();

    const { eventsSent, eventsFailed, retriesTotal } = this.reporterQueue.stats;
    console.warn(
      `[spechive] Run complete: ${eventsSent} sent, ${eventsFailed} failed, ${retriesTotal} retries`,
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

      this.reporterQueue.enqueue({
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

        this.reporterQueue.enqueue({
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
          `[spechive] Skipping artifact "${attachment.name}" (${buffer.length} bytes exceeds ${ARTIFACT_SIZE_LIMIT} byte limit)`,
        );
        continue;
      }

      if (buffer.length > ARTIFACT_SIZE_WARNING) {
        console.warn(`[spechive] Large artifact "${attachment.name}" (${buffer.length} bytes)`);
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
        console.warn(`[spechive] Failed to get presigned URL for artifact "${attachment.name}"`);
        continue;
      }

      const uploaded = await this.client.uploadToPresignedUrl(
        presign.uploadUrl,
        buffer,
        contentType,
      );
      if (!uploaded) {
        console.warn(`[spechive] Failed to upload artifact "${attachment.name}" to S3`);
        continue;
      }

      const artifactType = mapContentTypeToArtifactType(attachment.contentType);

      this.reporterQueue.enqueue({
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

function buildDefaultRunName(suites: Suite[]): string {
  const projects = suites.map((s) => s.title).filter(Boolean);
  return projects.length > 0 ? `Playwright · ${projects.join(', ')}` : 'Playwright';
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

export type { SpecHiveReporterConfig } from './types.js';
