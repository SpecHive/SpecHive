import {
  RunStatus,
  TestStatus,
  ArtifactType,
  asArtifactId,
  asRunId,
  asSuiteId,
  asTestId,
} from '@assertly/shared-types';
import { z } from 'zod';

const MAX_METADATA_BYTES = 1_000_000;

const baseEnvelopeFields = {
  version: z.literal('1'),
  timestamp: z.string().datetime(),
  runId: z.string().uuid().transform(asRunId),
};

export const RunStartSchema = z.object({
  ...baseEnvelopeFields,
  eventType: z.literal('run.start'),
  payload: z.object({
    runName: z.string().optional(),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          try {
            return JSON.stringify(val).length <= MAX_METADATA_BYTES;
          } catch {
            return false;
          }
        },
        { message: 'metadata must be under 1MB when serialized' },
      ),
  }),
});

export const RunEndSchema = z.object({
  ...baseEnvelopeFields,
  eventType: z.literal('run.end'),
  payload: z.object({
    status: z.nativeEnum(RunStatus),
  }),
});

export const SuiteStartSchema = z.object({
  ...baseEnvelopeFields,
  eventType: z.literal('suite.start'),
  payload: z.object({
    suiteId: z.string().uuid().transform(asSuiteId),
    suiteName: z.string().max(500),
    parentSuiteId: z.string().uuid().transform(asSuiteId).optional(),
  }),
});

export const SuiteEndSchema = z.object({
  ...baseEnvelopeFields,
  eventType: z.literal('suite.end'),
  payload: z.object({
    suiteId: z.string().uuid().transform(asSuiteId),
  }),
});

export const TestStartSchema = z.object({
  ...baseEnvelopeFields,
  eventType: z.literal('test.start'),
  payload: z.object({
    testId: z.string().uuid().transform(asTestId),
    suiteId: z.string().uuid().transform(asSuiteId),
    testName: z.string().max(500),
  }),
});

export const TestEndSchema = z.object({
  ...baseEnvelopeFields,
  eventType: z.literal('test.end'),
  payload: z.object({
    testId: z.string().uuid().transform(asTestId),
    status: z.nativeEnum(TestStatus),
    durationMs: z.number().nonnegative().optional(),
    errorMessage: z.string().max(10_000).optional(),
    stackTrace: z.string().max(50_000).optional(),
    retryCount: z.number().nonnegative().int().optional(),
  }),
});

export const ArtifactUploadSchema = z.object({
  ...baseEnvelopeFields,
  eventType: z.literal('artifact.upload'),
  payload: z.object({
    artifactId: z.string().uuid().transform(asArtifactId),
    testId: z.string().uuid().transform(asTestId),
    artifactType: z.nativeEnum(ArtifactType),
    name: z.string().max(500),
    storagePath: z.string().max(1000),
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
