import { z } from 'zod';

export const OutboxyEnvelopeSchema = z.object({
  id: z.string(),
  aggregateType: z.string(),
  aggregateId: z.string(),
  eventType: z.string(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime().optional(),
});

export type OutboxyEnvelope = z.infer<typeof OutboxyEnvelopeSchema>;
