/**
 * Factory functions for building event objects matching the reporter-core-protocol v1 schema.
 * Each returns a plain object — no Zod parsing.
 */

import type {
  RunStartEvent,
  RunEndEvent,
  SuiteStartEvent,
  SuiteEndEvent,
  TestStartEvent,
  TestEndEvent,
  ArtifactUploadEvent,
} from '@assertly/reporter-core-protocol';

/** Typed partial overrides for an event — envelope fields + nested payload. */
type EventOverrides<T extends { payload: unknown }> = Partial<Omit<T, 'payload'>> & {
  payload?: Partial<T['payload']>;
};

function randomUUID(): string {
  return crypto.randomUUID();
}

function nowISO(): string {
  return new Date().toISOString();
}

/** Build an event, merging top-level and payload overrides correctly. */
function buildEvent(
  eventType: string,
  defaultPayload: Record<string, unknown>,
  overrides?: Record<string, unknown>,
) {
  const { payload: payloadOverrides, ...topLevelOverrides } = overrides ?? {};
  return {
    version: '1' as const,
    timestamp: nowISO(),
    runId: randomUUID(),
    eventType,
    ...topLevelOverrides,
    payload: {
      ...defaultPayload,
      ...(payloadOverrides as Record<string, unknown> | undefined),
    },
  };
}

/** Create a `run.start` event with optional typed overrides. */
export function createRunStartEvent(overrides?: EventOverrides<RunStartEvent>) {
  return buildEvent('run.start', {}, overrides as Record<string, unknown>);
}

/** Create a `run.end` event with optional typed overrides. */
export function createRunEndEvent(overrides?: EventOverrides<RunEndEvent>) {
  return buildEvent('run.end', { status: 'passed' }, overrides as Record<string, unknown>);
}

/** Create a `suite.start` event with optional typed overrides. */
export function createSuiteStartEvent(overrides?: EventOverrides<SuiteStartEvent>) {
  return buildEvent(
    'suite.start',
    { suiteId: randomUUID(), suiteName: 'Test Suite' },
    overrides as Record<string, unknown>,
  );
}

/** Create a `suite.end` event with optional typed overrides. */
export function createSuiteEndEvent(overrides?: EventOverrides<SuiteEndEvent>) {
  return buildEvent('suite.end', { suiteId: randomUUID() }, overrides as Record<string, unknown>);
}

/** Create a `test.start` event with optional typed overrides. */
export function createTestStartEvent(overrides?: EventOverrides<TestStartEvent>) {
  return buildEvent(
    'test.start',
    { testId: randomUUID(), suiteId: randomUUID(), testName: 'test case' },
    overrides as Record<string, unknown>,
  );
}

/** Create a `test.end` event with optional typed overrides. */
export function createTestEndEvent(overrides?: EventOverrides<TestEndEvent>) {
  return buildEvent(
    'test.end',
    { testId: randomUUID(), status: 'passed', durationMs: 100 },
    overrides as Record<string, unknown>,
  );
}

/** Create an `artifact.upload` event with optional typed overrides. */
export function createArtifactUploadEvent(overrides?: EventOverrides<ArtifactUploadEvent>) {
  return buildEvent(
    'artifact.upload',
    {
      artifactId: randomUUID(),
      testId: randomUUID(),
      artifactType: 'screenshot',
      name: 'screenshot.png',
      storagePath: 'org/proj/run/test/screenshot.png',
    },
    overrides as Record<string, unknown>,
  );
}

interface FullRunOptions {
  runId?: string;
  suiteId?: string;
  testId?: string;
  suiteName?: string;
  testName?: string;
  testStatus?: string;
  durationMs?: number;
  runName?: string;
}

/**
 * Create a complete lifecycle event set: run.start → suite.start → test.start → test.end → suite.end → run.end.
 * Returns the generated IDs alongside the event array.
 */
export function createFullRunEvents(options?: FullRunOptions) {
  const runId = options?.runId ?? randomUUID();
  const suiteId = options?.suiteId ?? randomUUID();
  const testId = options?.testId ?? randomUUID();

  const events = [
    {
      version: '1' as const,
      timestamp: nowISO(),
      runId,
      eventType: 'run.start' as const,
      payload: options?.runName ? { runName: options.runName } : {},
    },
    {
      version: '1' as const,
      timestamp: nowISO(),
      runId,
      eventType: 'suite.start' as const,
      payload: { suiteId, suiteName: options?.suiteName ?? 'Test Suite' },
    },
    {
      version: '1' as const,
      timestamp: nowISO(),
      runId,
      eventType: 'test.start' as const,
      payload: { testId, suiteId, testName: options?.testName ?? 'test case' },
    },
    {
      version: '1' as const,
      timestamp: nowISO(),
      runId,
      eventType: 'test.end' as const,
      payload: {
        testId,
        status: options?.testStatus ?? 'passed',
        durationMs: options?.durationMs ?? 100,
      },
    },
    {
      version: '1' as const,
      timestamp: nowISO(),
      runId,
      eventType: 'suite.end' as const,
      payload: { suiteId },
    },
    {
      version: '1' as const,
      timestamp: nowISO(),
      runId,
      eventType: 'run.end' as const,
      payload: { status: 'passed' },
    },
  ];

  return { runId, suiteId, testId, events };
}
