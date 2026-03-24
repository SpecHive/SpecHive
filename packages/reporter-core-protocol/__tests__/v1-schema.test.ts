import { RunStatus, TestStatus, ArtifactType } from '@spechive/shared-types';
import type { ArtifactId, RunId, SuiteId, TestId } from '@spechive/shared-types';
import { describe, it, expect, expectTypeOf } from 'vitest';

import {
  RunStartSchema,
  RunEndSchema,
  SuiteStartSchema,
  SuiteEndSchema,
  TestStartSchema,
  TestEndSchema,
  ArtifactUploadSchema,
  V1EventSchema,
} from '../src/v1/schema.js';

const BASE_ENVELOPE = {
  version: '1' as const,
  timestamp: '2026-02-24T10:00:00.000Z',
  runId: '00000000-0000-4000-8000-000000000001',
};

const SUITE_ID = '00000000-0000-4000-8000-000000000002';
const TEST_ID = '00000000-0000-4000-8000-000000000003';
const ARTIFACT_ID = '00000000-0000-4000-8000-000000000004';

describe('RunStartSchema', () => {
  it('parses a valid run.start event', () => {
    const result = RunStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'run.start',
      payload: {
        runName: 'CI Run #42',
        metadata: { branch: 'main', commit: 'abc123' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('parses a minimal run.start event without optional fields', () => {
    const result = RunStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'run.start',
      payload: {},
    });
    expect(result.success).toBe(true);
  });

  it('fails when eventType does not match', () => {
    const result = RunStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'run.end',
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it('parses run.start with full ci object', () => {
    const result = RunStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'run.start',
      payload: {
        runName: 'CI Run',
        ci: {
          branch: 'main',
          commitSha: 'abc1234567890def1234567890abcdef12345678',
          ciUrl: 'https://github.com/org/repo/actions/runs/123',
          ciProvider: 'github-actions',
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('parses run.start with partial ci (only branch)', () => {
    const result = RunStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'run.start',
      payload: {
        ci: {
          branch: 'feature/add-ci-info',
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid commitSha (not hex)', () => {
    const result = RunStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'run.start',
      payload: {
        ci: {
          commitSha: 'not-hex-value',
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects commitSha that is too short', () => {
    const result = RunStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'run.start',
      payload: {
        ci: {
          commitSha: 'abc',
        },
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('RunEndSchema', () => {
  it('parses a valid run.end event', () => {
    const result = RunEndSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'run.end',
      payload: { status: RunStatus.Passed },
    });
    expect(result.success).toBe(true);
  });

  it('fails when status is not a valid RunStatus value', () => {
    const result = RunEndSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'run.end',
      payload: { status: 'unknown_status' },
    });
    expect(result.success).toBe(false);
  });

  it('fails when payload is missing', () => {
    const result = RunEndSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'run.end',
    });
    expect(result.success).toBe(false);
  });
});

describe('SuiteStartSchema', () => {
  it('parses a valid suite.start event', () => {
    const result = SuiteStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'suite.start',
      payload: {
        suiteId: SUITE_ID,
        suiteName: 'Auth Tests',
        parentSuiteId: '00000000-0000-4000-8000-000000000099',
      },
    });
    expect(result.success).toBe(true);
  });

  it('parses suite.start without optional parentSuiteId', () => {
    const result = SuiteStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'suite.start',
      payload: { suiteId: SUITE_ID, suiteName: 'Auth Tests' },
    });
    expect(result.success).toBe(true);
  });

  it('fails when suiteId is not a valid UUID', () => {
    const result = SuiteStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'suite.start',
      payload: { suiteId: 'not-a-uuid', suiteName: 'Auth Tests' },
    });
    expect(result.success).toBe(false);
  });

  it('fails when suiteName is missing', () => {
    const result = SuiteStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'suite.start',
      payload: { suiteId: SUITE_ID },
    });
    expect(result.success).toBe(false);
  });
});

describe('SuiteEndSchema', () => {
  it('parses a valid suite.end event', () => {
    const result = SuiteEndSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'suite.end',
      payload: { suiteId: SUITE_ID },
    });
    expect(result.success).toBe(true);
  });

  it('fails when suiteId is missing', () => {
    const result = SuiteEndSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'suite.end',
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it('fails when suiteId is not a valid UUID', () => {
    const result = SuiteEndSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'suite.end',
      payload: { suiteId: 'bad-id' },
    });
    expect(result.success).toBe(false);
  });
});

describe('TestStartSchema', () => {
  it('parses a valid test.start event', () => {
    const result = TestStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'test.start',
      payload: {
        testId: TEST_ID,
        suiteId: SUITE_ID,
        testName: 'should login successfully',
      },
    });
    expect(result.success).toBe(true);
  });

  it('fails when testId is not a valid UUID', () => {
    const result = TestStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'test.start',
      payload: {
        testId: 'not-uuid',
        suiteId: SUITE_ID,
        testName: 'should login',
      },
    });
    expect(result.success).toBe(false);
  });

  it('fails when testName is missing', () => {
    const result = TestStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'test.start',
      payload: { testId: TEST_ID, suiteId: SUITE_ID },
    });
    expect(result.success).toBe(false);
  });
});

describe('TestEndSchema', () => {
  it('parses a valid test.end event with all optional fields', () => {
    const result = TestEndSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'test.end',
      payload: {
        testId: TEST_ID,
        status: TestStatus.Failed,
        durationMs: 1500,
        errorMessage: 'Expected true but got false',
        stackTrace: 'at Object.<anonymous> (test.ts:10:5)',
        retryCount: 2,
      },
    });
    expect(result.success).toBe(true);
  });

  it('parses a minimal test.end event with only required fields', () => {
    const result = TestEndSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'test.end',
      payload: { testId: TEST_ID, status: TestStatus.Passed },
    });
    expect(result.success).toBe(true);
  });

  it('fails when status is not a valid TestStatus value', () => {
    const result = TestEndSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'test.end',
      payload: { testId: TEST_ID, status: 'invalid' },
    });
    expect(result.success).toBe(false);
  });

  it('fails when durationMs is negative', () => {
    const result = TestEndSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'test.end',
      payload: { testId: TEST_ID, status: TestStatus.Passed, durationMs: -1 },
    });
    expect(result.success).toBe(false);
  });

  it('fails when retryCount is not an integer', () => {
    const result = TestEndSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'test.end',
      payload: { testId: TEST_ID, status: TestStatus.Passed, retryCount: 1.5 },
    });
    expect(result.success).toBe(false);
  });
});

describe('ArtifactUploadSchema', () => {
  it('parses a valid artifact.upload event', () => {
    const result = ArtifactUploadSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'artifact.upload',
      payload: {
        artifactId: ARTIFACT_ID,
        testId: TEST_ID,
        artifactType: ArtifactType.Screenshot,
        name: 'failure-screenshot.png',
        storagePath: 'org/proj/run/test/artifact_file.png',
        mimeType: 'image/png',
      },
    });
    expect(result.success).toBe(true);
  });

  it('parses artifact.upload without optional mimeType', () => {
    const result = ArtifactUploadSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'artifact.upload',
      payload: {
        artifactId: ARTIFACT_ID,
        testId: TEST_ID,
        artifactType: ArtifactType.Log,
        name: 'test.log',
        storagePath: 'org/proj/run/test/artifact_file.log',
      },
    });
    expect(result.success).toBe(true);
  });

  it('fails when artifactType is not a valid ArtifactType value', () => {
    const result = ArtifactUploadSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'artifact.upload',
      payload: {
        artifactId: ARTIFACT_ID,
        testId: TEST_ID,
        artifactType: 'gif',
        name: 'animation.gif',
        storagePath: 'org/proj/run/test/animation.gif',
      },
    });
    expect(result.success).toBe(false);
  });

  it('fails when artifactId is missing', () => {
    const result = ArtifactUploadSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'artifact.upload',
      payload: {
        testId: TEST_ID,
        artifactType: ArtifactType.Screenshot,
        name: 'screenshot.png',
        storagePath: 'org/proj/run/test/screenshot.png',
      },
    });
    expect(result.success).toBe(false);
  });

  it('fails when storagePath is missing', () => {
    const result = ArtifactUploadSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'artifact.upload',
      payload: {
        artifactId: ARTIFACT_ID,
        testId: TEST_ID,
        artifactType: ArtifactType.Screenshot,
        name: 'screenshot.png',
      },
    });
    expect(result.success).toBe(false);
  });

  it('fails when artifactId is not a valid UUID', () => {
    const result = ArtifactUploadSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'artifact.upload',
      payload: {
        artifactId: 'not-a-uuid',
        testId: TEST_ID,
        artifactType: ArtifactType.Screenshot,
        name: 'screenshot.png',
        storagePath: 'org/proj/run/test/screenshot.png',
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('V1EventSchema discriminated union', () => {
  it('correctly identifies a run.start event', () => {
    const result = V1EventSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'run.start',
      payload: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventType).toBe('run.start');
    }
  });

  it('correctly identifies a test.end event', () => {
    const result = V1EventSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'test.end',
      payload: { testId: TEST_ID, status: TestStatus.Passed },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventType).toBe('test.end');
    }
  });

  it('correctly identifies an artifact.upload event', () => {
    const result = V1EventSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'artifact.upload',
      payload: {
        artifactId: ARTIFACT_ID,
        testId: TEST_ID,
        artifactType: ArtifactType.Trace,
        name: 'trace.zip',
        storagePath: 'org/proj/run/test/trace.zip',
      },
    });
    expect(result.success).toBe(true);
  });

  it('fails when eventType is not a recognized v1 event type', () => {
    const result = V1EventSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'unknown.event',
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it('fails when the envelope version is not "1"', () => {
    const result = V1EventSchema.safeParse({
      version: '2',
      timestamp: '2026-02-24T10:00:00.000Z',
      runId: BASE_ENVELOPE.runId,
      eventType: 'run.start',
      payload: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('Edge cases: timestamp and runId', () => {
  it('rejects invalid ISO 8601 timestamp', () => {
    const result = V1EventSchema.safeParse({
      version: '1',
      timestamp: 'not-a-date',
      runId: '00000000-0000-4000-8000-000000000001',
      eventType: 'run.start',
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID runId', () => {
    const result = V1EventSchema.safeParse({
      version: '1',
      timestamp: '2026-02-24T10:00:00.000Z',
      runId: 'not-a-uuid',
      eventType: 'run.start',
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing runId', () => {
    const result = V1EventSchema.safeParse({
      version: '1',
      timestamp: '2026-02-24T10:00:00.000Z',
      eventType: 'run.start',
      payload: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('V1EventSchema union completeness', () => {
  it('correctly identifies a run.end event', () => {
    const result = V1EventSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'run.end',
      payload: { status: RunStatus.Passed },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventType).toBe('run.end');
    }
  });

  it('correctly identifies a suite.start event', () => {
    const result = V1EventSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'suite.start',
      payload: { suiteId: SUITE_ID, suiteName: 'Auth Tests' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventType).toBe('suite.start');
    }
  });

  it('correctly identifies a suite.end event', () => {
    const result = V1EventSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'suite.end',
      payload: { suiteId: SUITE_ID },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventType).toBe('suite.end');
    }
  });

  it('correctly identifies a test.start event', () => {
    const result = V1EventSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'test.start',
      payload: { testId: TEST_ID, suiteId: SUITE_ID, testName: 'should login successfully' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventType).toBe('test.start');
    }
  });
});

describe('Branded ID types', () => {
  it('parsed runId is branded as RunId', () => {
    const result = RunStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'run.start',
      payload: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expectTypeOf(result.data.runId).toEqualTypeOf<RunId>();
    }
  });

  it('parsed suiteId is branded as SuiteId', () => {
    const result = SuiteStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'suite.start',
      payload: { suiteId: SUITE_ID, suiteName: 'Auth Tests' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expectTypeOf(result.data.payload.suiteId).toEqualTypeOf<SuiteId>();
    }
  });

  it('parsed testId is branded as TestId', () => {
    const result = TestStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'test.start',
      payload: { testId: TEST_ID, suiteId: SUITE_ID, testName: 'should work' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expectTypeOf(result.data.payload.testId).toEqualTypeOf<TestId>();
    }
  });

  it('parsed artifactId is branded as ArtifactId', () => {
    const result = ArtifactUploadSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'artifact.upload',
      payload: {
        artifactId: ARTIFACT_ID,
        testId: TEST_ID,
        artifactType: ArtifactType.Screenshot,
        name: 'screenshot.png',
        storagePath: 'org/proj/run/test/screenshot.png',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expectTypeOf(result.data.payload.artifactId).toEqualTypeOf<ArtifactId>();
    }
  });
});
