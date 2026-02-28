import { baseEnvSchema } from '@assertly/nestjs-common';
import { z } from 'zod';

export const envSchema = baseEnvSchema
  .extend({
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(1),
    JWT_EXPIRES_IN: z.string().default('24h'),
    CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
    MINIO_ENDPOINT: z.string().default('localhost:9000'),
    MINIO_USE_SSL: z.enum(['true', 'false']).default('false'),
    MINIO_BUCKET: z.string().default('assertly-artifacts'),
    MINIO_APP_ACCESS_KEY: z.string().default('assertly-app'),
    MINIO_APP_SECRET_KEY: z.string().default('assertly-app-secret-key'),
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
  .refine((env) => env.NODE_ENV !== 'production' || env.JWT_SECRET.length >= 64, {
    message: 'JWT_SECRET must be at least 64 characters in production',
    path: ['JWT_SECRET'],
  });

export type EnvConfig = z.infer<typeof envSchema>;
