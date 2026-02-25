import type { z } from 'zod';

import type {
  RunStartSchema,
  RunEndSchema,
  SuiteStartSchema,
  SuiteEndSchema,
  TestStartSchema,
  TestEndSchema,
  ArtifactUploadSchema,
  V1EventSchema,
} from './schema.js';

export type RunStartEvent = z.infer<typeof RunStartSchema>;
export type RunEndEvent = z.infer<typeof RunEndSchema>;
export type SuiteStartEvent = z.infer<typeof SuiteStartSchema>;
export type SuiteEndEvent = z.infer<typeof SuiteEndSchema>;
export type TestStartEvent = z.infer<typeof TestStartSchema>;
export type TestEndEvent = z.infer<typeof TestEndSchema>;
export type ArtifactUploadEvent = z.infer<typeof ArtifactUploadSchema>;

export type V1Event = z.infer<typeof V1EventSchema>;
