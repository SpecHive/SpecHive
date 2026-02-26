import { baseEnvSchema } from '@assertly/nestjs-common';
import { z } from 'zod';

export const envSchema = baseEnvSchema
  .extend({
    DATABASE_URL: z.string().url(),
    WORKER_WEBHOOK_URL: z.string().url().default('http://worker:3001/webhooks/outboxy'),
    CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
    OUTBOXY_API_URL: z.string().url().optional(),
  })
  .refine((env) => env.NODE_ENV !== 'production' || !env.CORS_ORIGIN.includes('localhost'), {
    message: 'CORS_ORIGIN must not contain localhost in production',
    path: ['CORS_ORIGIN'],
  });

export type EnvConfig = z.infer<typeof envSchema>;
