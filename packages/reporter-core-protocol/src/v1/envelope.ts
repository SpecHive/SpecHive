import { z } from 'zod';

import { V1EventSchema } from './schema.js';

export const EnrichedEventEnvelopeSchema = z.object({
  organizationId: z.string().uuid(),
  projectId: z.string().uuid(),
  event: V1EventSchema,
});

export type EnrichedEventEnvelope = z.infer<typeof EnrichedEventEnvelopeSchema>;
