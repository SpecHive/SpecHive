import { baseEnvSchema } from '@assertly/nestjs-common';
import { z } from 'zod';

export const envSchema = baseEnvSchema
  .extend({
    DATABASE_URL: z.string().url(),
    WORKER_WEBHOOK_URL: z.string().url().default('http://worker:3001/webhooks/outboxy'),
    CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
    OUTBOXY_API_URL: z.string().url().optional(),
    MINIO_ENDPOINT: z.string().default('localhost:9000'),
    MINIO_USE_SSL: z.enum(['true', 'false']).default('false'),
    MINIO_BUCKET: z.string().default('assertly-artifacts'),
    MINIO_APP_ACCESS_KEY: z.string().default('assertly-app'),
    MINIO_APP_SECRET_KEY: z.string().default('assertly-app-secret-key'),
    TOKEN_HASH_KEY: z.string().optional(),
  })
  .refine((env) => env.NODE_ENV !== 'production' || !env.CORS_ORIGIN.includes('localhost'), {
    message: 'CORS_ORIGIN must not contain localhost in production',
    path: ['CORS_ORIGIN'],
  })
  .refine(
    (env) => {
      if (env.NODE_ENV !== 'production') return true;
      const isLoopback = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(env.MINIO_ENDPOINT);
      return isLoopback || env.MINIO_USE_SSL === 'true';
    },
    {
      message: 'MINIO_USE_SSL must be true in production for non-localhost endpoints',
      path: ['MINIO_USE_SSL'],
    },
  )
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' || (!!env.TOKEN_HASH_KEY && env.TOKEN_HASH_KEY.length >= 32),
    {
      message: 'TOKEN_HASH_KEY is required and must be at least 32 characters in production',
      path: ['TOKEN_HASH_KEY'],
    },
  );

export type EnvConfig = z.infer<typeof envSchema>;
