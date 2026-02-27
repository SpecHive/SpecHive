import { baseEnvSchema } from '@assertly/nestjs-common';
import { z } from 'zod';

export const envSchema = baseEnvSchema
  .extend({
    PORT: z.coerce.number().default(3001),
    WEBHOOK_SECRET: z.string().min(32),
    DATABASE_URL: z.string().url(),
    MINIO_ENDPOINT: z.string().default('localhost:9000'),
    MINIO_USE_SSL: z.enum(['true', 'false']).default('false'),
    MINIO_BUCKET: z.string().default('assertly-artifacts'),
    MINIO_APP_ACCESS_KEY: z.string().default('assertly-app'),
    MINIO_APP_SECRET_KEY: z.string().default('assertly-app-secret-key'),
  })
  .refine((env) => env.NODE_ENV !== 'production' || !env.WEBHOOK_SECRET.startsWith('change-me'), {
    message: 'WEBHOOK_SECRET must not use a placeholder value in production',
    path: ['WEBHOOK_SECRET'],
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
  );

export type EnvConfig = z.infer<typeof envSchema>;
