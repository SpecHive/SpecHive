import { baseEnvSchema } from '@assertly/nestjs-common';
import { z } from 'zod';

export const envSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().default(3001),
  WEBHOOK_SECRET: z.string().min(1),
});

export type EnvConfig = z.infer<typeof envSchema>;
