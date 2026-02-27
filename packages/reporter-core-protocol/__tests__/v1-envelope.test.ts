import { RunStatus, TestStatus, ArtifactType } from '@assertly/shared-types';
import { describe, it, expect } from 'vitest';

import { EnrichedEventEnvelopeSchema } from '../src/v1/envelope.js';

const ORG_ID = '00000000-0000-4000-8000-000000000010';
const PROJECT_ID = '00000000-0000-4000-8000-000000000020';
const RUN_ID = '00000000-0000-4000-8000-000000000001';
const SUITE_ID = '00000000-0000-4000-8000-000000000002';
const TEST_ID = '00000000-0000-4000-8000-000000000003';

const BASE_EVENT = {
  version: '1' as const,
  timestamp: '2026-02-24T10:00:00.000Z',
  runId: RUN_ID,
};

describe('EnrichedEventEnvelopeSchema', () => {
  it('validates envelope with run.start event', () => {
    const result = EnrichedEventEnvelopeSchema.safeParse({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      event: { ...BASE_EVENT, eventType: 'run.start', payload: {} },
    });
    expect(result.success).toBe(true);
  });

  it('validates envelope with run.end event', () => {
    const result = EnrichedEventEnvelopeSchema.safeParse({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      event: { ...BASE_EVENT, eventType: 'run.end', payload: { status: RunStatus.Passed } },
    });
    expect(result.success).toBe(true);
  });

  it('validates envelope with suite.start event', () => {
    const result = EnrichedEventEnvelopeSchema.safeParse({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      event: {
        ...BASE_EVENT,
        eventType: 'suite.start',
        payload: { suiteId: SUITE_ID, suiteName: 'Auth tests' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('validates envelope with suite.end event', () => {
    const result = EnrichedEventEnvelopeSchema.safeParse({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      event: { ...BASE_EVENT, eventType: 'suite.end', payload: { suiteId: SUITE_ID } },
    });
    expect(result.success).toBe(true);
  });

  it('validates envelope with test.start event', () => {
    const result = EnrichedEventEnvelopeSchema.safeParse({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      event: {
        ...BASE_EVENT,
        eventType: 'test.start',
        payload: { testId: TEST_ID, suiteId: SUITE_ID, testName: 'login works' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('validates envelope with test.end event', () => {
    const result = EnrichedEventEnvelopeSchema.safeParse({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      event: {
        ...BASE_EVENT,
        eventType: 'test.end',
        payload: { testId: TEST_ID, status: TestStatus.Passed },
      },
    });
    expect(result.success).toBe(true);
  });

  it('validates envelope with artifact.upload event', () => {
    const result = EnrichedEventEnvelopeSchema.safeParse({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      event: {
        ...BASE_EVENT,
        eventType: 'artifact.upload',
        payload: {
          testId: TEST_ID,
          artifactType: ArtifactType.Screenshot,
          name: 'failure.png',
          data: 'base64data',
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('fails when organizationId is missing', () => {
    const result = EnrichedEventEnvelopeSchema.safeParse({
      projectId: PROJECT_ID,
      event: { ...BASE_EVENT, eventType: 'run.start', payload: {} },
    });
    expect(result.success).toBe(false);
  });

  it('fails when projectId is missing', () => {
    const result = EnrichedEventEnvelopeSchema.safeParse({
      organizationId: ORG_ID,
      event: { ...BASE_EVENT, eventType: 'run.start', payload: {} },
    });
    expect(result.success).toBe(false);
  });

  it('fails when organizationId is not a valid UUID', () => {
    const result = EnrichedEventEnvelopeSchema.safeParse({
      organizationId: 'not-a-uuid',
      projectId: PROJECT_ID,
      event: { ...BASE_EVENT, eventType: 'run.start', payload: {} },
    });
    expect(result.success).toBe(false);
  });

  it('fails when projectId is not a valid UUID', () => {
    const result = EnrichedEventEnvelopeSchema.safeParse({
      organizationId: ORG_ID,
      projectId: 'not-a-uuid',
      event: { ...BASE_EVENT, eventType: 'run.start', payload: {} },
    });
    expect(result.success).toBe(false);
  });

  it('fails when event is missing', () => {
    const result = EnrichedEventEnvelopeSchema.safeParse({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
    });
    expect(result.success).toBe(false);
  });

  it('fails when event is invalid', () => {
    const result = EnrichedEventEnvelopeSchema.safeParse({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      event: {
        version: '1',
        timestamp: '2026-02-24T10:00:00.000Z',
        runId: RUN_ID,
        eventType: 'unknown.event',
        payload: {},
      },
    });
    expect(result.success).toBe(false);
  });
});
