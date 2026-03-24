import { z } from 'zod';

export const OutboxyEventSchema = z.object({
  eventId: z.string(),
  aggregateType: z.string(),
  aggregateId: z.string(),
  eventType: z.string(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime().optional(),
});

export type OutboxyEvent = z.infer<typeof OutboxyEventSchema>;

export const OutboxyBatchSchema = z
  .object({
    batch: z.literal(true),
    count: z.number().int().nonnegative(),
    events: z.array(OutboxyEventSchema),
  })
  .refine((data) => data.count === data.events.length, {
    message: 'count must match events.length',
    path: ['count'],
  });

export type OutboxyBatch = z.infer<typeof OutboxyBatchSchema>;
