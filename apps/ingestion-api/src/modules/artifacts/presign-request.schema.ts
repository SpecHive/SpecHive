import { z } from 'zod';

const MAX_FILE_SIZE_BYTES = 10_485_760;

export const PresignRequestSchema = z.object({
  runId: z.string().uuid(),
  testId: z.string().uuid(),
  fileName: z.string().min(1).max(500),
  contentType: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
});

export type PresignRequest = z.infer<typeof PresignRequestSchema>;
