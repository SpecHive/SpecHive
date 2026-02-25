import { baseEnvSchema } from '@assertly/nestjs-common';
import { z } from 'zod';

export const envSchema = baseEnvSchema.extend({
  DATABASE_URL: z.string().url(),
  WORKER_WEBHOOK_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  OUTBOXY_API_URL: z.string().url().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;
