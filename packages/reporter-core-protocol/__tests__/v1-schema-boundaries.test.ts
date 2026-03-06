import { ArtifactType } from '@assertly/shared-types';
import { describe, it, expect } from 'vitest';

import { SuiteStartSchema, TestStartSchema, ArtifactUploadSchema } from '../src/v1/schema.js';

const BASE_ENVELOPE = {
  version: '1' as const,
  timestamp: '2026-02-24T10:00:00.000Z',
  runId: '00000000-0000-4000-8000-000000000001',
};

const SUITE_ID = '00000000-0000-4000-8000-000000000002';
const TEST_ID = '00000000-0000-4000-8000-000000000003';
const ARTIFACT_ID = '00000000-0000-4000-8000-000000000004';

describe('SuiteStartSchema – suiteName boundaries', () => {
  it('accepts suiteName at exactly 500 characters', () => {
    const result = SuiteStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'suite.start',
      payload: { suiteId: SUITE_ID, suiteName: 'a'.repeat(500) },
    });
    expect(result.success).toBe(true);
  });

  it('rejects suiteName at 501 characters', () => {
    const result = SuiteStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'suite.start',
      payload: { suiteId: SUITE_ID, suiteName: 'a'.repeat(501) },
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty suiteName (no min length constraint)', () => {
    const result = SuiteStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'suite.start',
      payload: { suiteId: SUITE_ID, suiteName: '' },
    });
    expect(result.success).toBe(true);
  });
});

describe('TestStartSchema – testName boundaries', () => {
  it('accepts testName at exactly 500 characters', () => {
    const result = TestStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'test.start',
      payload: { testId: TEST_ID, suiteId: SUITE_ID, testName: 'a'.repeat(500) },
    });
    expect(result.success).toBe(true);
  });

  it('rejects testName at 501 characters', () => {
    const result = TestStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'test.start',
      payload: { testId: TEST_ID, suiteId: SUITE_ID, testName: 'a'.repeat(501) },
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty testName (no min length constraint)', () => {
    const result = TestStartSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'test.start',
      payload: { testId: TEST_ID, suiteId: SUITE_ID, testName: '' },
    });
    expect(result.success).toBe(true);
  });
});

describe('ArtifactUploadSchema – name boundaries', () => {
  it('accepts name at exactly 500 characters', () => {
    const result = ArtifactUploadSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'artifact.upload',
      payload: {
        artifactId: ARTIFACT_ID,
        testId: TEST_ID,
        artifactType: ArtifactType.Screenshot,
        name: 'a'.repeat(500),
        storagePath: 'org/proj/run/test/artifact_file.png',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects name at 501 characters', () => {
    const result = ArtifactUploadSchema.safeParse({
      ...BASE_ENVELOPE,
      eventType: 'artifact.upload',
      payload: {
        artifactId: ARTIFACT_ID,
        testId: TEST_ID,
        artifactType: ArtifactType.Screenshot,
        name: 'a'.repeat(501),
        storagePath: 'org/proj/run/test/artifact_file.png',
      },
    });
    expect(result.success).toBe(false);
  });
});
