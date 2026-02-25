import { RunStatus, TestStatus, ArtifactType } from '@assertly/shared-types';
import { z } from 'zod';

const baseEnvelopeFields = {
  version: z.literal('1'),
  timestamp: z.string().datetime(),
  runId: z.string().uuid(),
};

export const RunStartSchema = z.object({
  ...baseEnvelopeFields,
  eventType: z.literal('run.start'),
  payload: z.object({
    runName: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const RunEndSchema = z.object({
  ...baseEnvelopeFields,
  eventType: z.literal('run.end'),
  payload: z.object({
    status: z.enum(RunStatus),
  }),
});

export const SuiteStartSchema = z.object({
  ...baseEnvelopeFields,
  eventType: z.literal('suite.start'),
  payload: z.object({
    suiteId: z.string().uuid(),
    suiteName: z.string(),
    parentSuiteId: z.string().uuid().optional(),
  }),
});

export const SuiteEndSchema = z.object({
  ...baseEnvelopeFields,
  eventType: z.literal('suite.end'),
  payload: z.object({
    suiteId: z.string().uuid(),
  }),
});

export const TestStartSchema = z.object({
  ...baseEnvelopeFields,
  eventType: z.literal('test.start'),
  payload: z.object({
    testId: z.string().uuid(),
    suiteId: z.string().uuid(),
    testName: z.string(),
  }),
});

export const TestEndSchema = z.object({
  ...baseEnvelopeFields,
  eventType: z.literal('test.end'),
  payload: z.object({
    testId: z.string().uuid(),
    status: z.enum(TestStatus),
    durationMs: z.number().nonnegative().optional(),
    errorMessage: z.string().optional(),
    stackTrace: z.string().optional(),
    retryCount: z.number().nonnegative().int().optional(),
  }),
});

export const ArtifactUploadSchema = z.object({
  ...baseEnvelopeFields,
  eventType: z.literal('artifact.upload'),
  payload: z.object({
    testId: z.string().uuid(),
    artifactType: z.enum(ArtifactType),
    name: z.string(),
    data: z.string(),
    mimeType: z.string().optional(),
  }),
});

export const V1EventSchema = z.discriminatedUnion('eventType', [
  RunStartSchema,
  RunEndSchema,
  SuiteStartSchema,
  SuiteEndSchema,
  TestStartSchema,
  TestEndSchema,
  ArtifactUploadSchema,
]);
