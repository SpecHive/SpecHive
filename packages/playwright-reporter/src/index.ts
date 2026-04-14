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
  MAX_STACK_TRACE_LENGTH,
} from '@spechive/reporter-client';
import type { BaseResolvedConfig } from '@spechive/reporter-client';
import {
  ArtifactType,
  MAX_ERROR_MESSAGE_LENGTH,
  RunStatus,
  TestStatus,
  asRunId,
  asSuiteId,
  asTestId,
  sanitizeArtifactName,
  stripAnsi,
} from '@spechive/shared-types';
import type { ArtifactId } from '@spechive/shared-types';
import type { RunId, SuiteId, TestId } from '@spechive/shared-types';

import { parsePlaywrightError } from './error-parser.js';
import type { SpecHiveReporterConfig } from './types.js';

/**
 * Derive a stable UUID from two strings so parallel Playwright projects
 * produce the same suite ID for the same logical suite.
 * Uses SHA-256 truncated to UUID format with version-5 and variant-1 markers.
 */
function deterministicUuid(namespace: string, name: string): string {
  const hash = crypto.createHash('sha256').update(`${namespace}:${name}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '5' + hash.slice(13, 16),
    ((parseInt(hash[16]!, 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

const ARTIFACT_SIZE_LIMIT = 10 * 1024 * 1024;
const ARTIFACT_SIZE_WARNING = 5 * 1024 * 1024;
const MAX_ERROR_NAME_LENGTH = 200;
const MAX_ERROR_SNIPPET_LENGTH = 5000;
const MAX_ERROR_LOCATION_FILE_LENGTH = 1000;

export function parseErrorName(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const match = message.match(/^([A-Z][A-Za-z]*Error|Error)(?::|[\n\r])/);
  return match?.[1]?.slice(0, MAX_ERROR_NAME_LENGTH);
}

function extractErrorMetadata(error: TestResult['error']) {
  if (!error) return {};

  // Strip ANSI codes before parsing — Playwright includes formatting in error.message
  const cleanMessage = error.message ? stripAnsi(error.message) : undefined;
  const errorName = parseErrorName(cleanMessage);

  const errorLocation = error.location
    ? {
        file: error.location.file.slice(0, MAX_ERROR_LOCATION_FILE_LENGTH),
        line: error.location.line,
        column: error.location.column,
      }
    : undefined;

  const errorSnippet = error.snippet ? error.snippet.slice(0, MAX_ERROR_SNIPPET_LENGTH) : undefined;

  const parsed = parsePlaywrightError(cleanMessage);
  // Fallback: errors with a recognized errorName but no structured pattern are 'runtime'
  const errorCategory = parsed?.errorCategory ?? (errorName ? 'runtime' : undefined);

  return {
    ...(errorName ? { errorName } : {}),
    ...(errorLocation ? { errorLocation } : {}),
    ...(errorSnippet ? { errorSnippet } : {}),
    ...(parsed ?? {}),
    ...(errorCategory ? { errorCategory } : {}),
  };
}

interface PlaywrightResolvedConfig extends BaseResolvedConfig {
  captureArtifacts: boolean;
}

function resolveConfig(config: SpecHiveReporterConfig): PlaywrightResolvedConfig {
  return { ...resolveBaseConfig(config), captureArtifacts: config.captureArtifacts ?? true };
}

export default class SpecHiveReporter implements Reporter {
  private readonly config: PlaywrightResolvedConfig;
  private readonly logger: BaseResolvedConfig['logger'];
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
    this.logger = this.config.logger;
    this.client = new SpecHiveClient(
      this.config.apiUrl,
      this.config.projectToken,
      undefined,
      this.config.maxRetries,
      this.logger,
    );
    this.reporterQueue = new ReporterQueue(this.client, {
      flushTimeout: this.config.flushTimeout,
      logger: this.logger,
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
      this.logger.warn(`[spechive] Cannot reach ${this.config.apiUrl}/health — events may be lost`);
    }

    this.runId = asRunId(crypto.randomUUID());
    const runName = this.config.runName ?? buildDefaultRunName(suite.suites);
    const ci = detectCi();

    const expectedTests = suite.allTests().length;

    this.reporterQueue.enqueue({
      version: '1',
      timestamp: new Date().toISOString(),
      runId: this.runId,
      eventType: 'run.start',
      payload: {
        runName,
        expectedTests,
        ...(ci ? { ci } : {}),
        ...(Object.keys(this.config.metadata).length > 0 ? { metadata: this.config.metadata } : {}),
      },
    });

    this.walkSuites(suite);
  }

  onTestBegin(test: TestCase, result: TestResult): void {
    if (!this.isEnabled) return;
    // Only send test.start on first attempt (retry 0)
    if (result.retry > 0) return;

    const testId = asTestId(crypto.randomUUID());
    const suiteId =
      this.suiteMap.get(test.parent) ??
      asSuiteId(
        test.parent ? deterministicUuid(this.runId, test.parent.title) : crypto.randomUUID(),
      );

    const entry = {
      testId,
      suiteId,
      testName: test.title,
      testCase: test,
      attempts: [] as TestResult[],
    };
    this.testTracker.set(test.id, entry);

    this.reporterQueue.enqueue({
      version: '1',
      timestamp: new Date().toISOString(),
      runId: this.runId,
      eventType: 'test.start',
      payload: { testId, suiteId, testName: test.title },
    });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (!this.isEnabled) return;

    const entry = this.testTracker.get(test.id);
    if (!entry) {
      this.logger.warn(
        `[spechive] onTestEnd called for unknown test "${test.title}" (id=${test.id}) — was onTestBegin skipped?`,
      );
      return;
    }

    entry.attempts.push(result);
    this.artifactPromises.push(
      this.processArtifacts(entry.testId, result.attachments, result.retry),
    );

    // Send test.end only when test is fully done (passed/skipped or all retries exhausted)
    const isFinalAttempt =
      result.status === 'passed' || result.status === 'skipped' || result.retry >= test.retries;
    if (!isFinalAttempt) return;

    this.sendTestEnd(entry);
  }

  async onEnd(result: FullResult): Promise<void> {
    if (!this.isEnabled) return;

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
    this.logger.info(
      `[spechive] Run complete: ${eventsSent} sent, ${eventsFailed} failed, ${retriesTotal} retries`,
    );
  }

  private sendTestEnd(entry: { testId: TestId; testCase: TestCase; attempts: TestResult[] }): void {
    const finalAttempt = entry.attempts[entry.attempts.length - 1]!;
    const status = this.resolveTestStatus(entry);

    const errorAttempt =
      status === TestStatus.Flaky
        ? [...entry.attempts].reverse().find((a) => a.status !== 'passed')
        : finalAttempt;

    const errorMessage = errorAttempt?.error?.message?.slice(0, MAX_ERROR_MESSAGE_LENGTH);
    const stackTrace = errorAttempt?.error?.stack?.slice(0, MAX_STACK_TRACE_LENGTH);
    const topLevelErrorMeta = extractErrorMetadata(errorAttempt?.error);

    const attempts = entry.attempts.map((attempt) => ({
      retryIndex: attempt.retry,
      status: mapTestStatus(attempt.status),
      durationMs: attempt.duration,
      startedAt: attempt.startTime.toISOString(),
      finishedAt: new Date(attempt.startTime.getTime() + attempt.duration).toISOString(),
      errorMessage: attempt.error?.message?.slice(0, MAX_ERROR_MESSAGE_LENGTH),
      stackTrace: attempt.error?.stack?.slice(0, MAX_STACK_TRACE_LENGTH),
      ...extractErrorMetadata(attempt.error),
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
        ...topLevelErrorMeta,
        retryCount: finalAttempt.retry,
        attempts,
      },
    });
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
        const suiteId = asSuiteId(deterministicUuid(this.runId, child.title));
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
        this.logger.error(
          `[spechive] Skipping artifact "${attachment.name}" (${buffer.length} bytes exceeds ${ARTIFACT_SIZE_LIMIT} byte limit)`,
        );
        continue;
      }

      if (buffer.length > ARTIFACT_SIZE_WARNING) {
        this.logger.warn(`[spechive] Large artifact "${attachment.name}" (${buffer.length} bytes)`);
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
        this.logger.warn(
          `[spechive] Failed to get presigned URL for artifact "${attachment.name}"`,
        );
        continue;
      }

      const uploaded = await this.client.uploadToPresignedUrl(
        presign.uploadUrl,
        buffer,
        contentType,
      );
      if (!uploaded) {
        this.logger.warn(`[spechive] Failed to upload artifact "${attachment.name}" to S3`);
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
