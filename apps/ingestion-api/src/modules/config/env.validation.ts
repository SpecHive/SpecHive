import { baseEnvSchema, minioEnvSchema, minioProductionRefinement } from '@spechive/nestjs-common';
import { z } from 'zod';

export const envSchema = baseEnvSchema
  .extend({
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().url(),
    WORKER_URL: z.string().url(),
    CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
    WEBHOOK_SECRET: z.string().min(32),
    ...minioEnvSchema.shape,
    TOKEN_HASH_KEY: z.string().min(32).optional(),
  })
  .refine((env) => env.NODE_ENV !== 'production' || !env.CORS_ORIGIN.includes('localhost'), {
    message: 'CORS_ORIGIN must not contain localhost in production',
    path: ['CORS_ORIGIN'],
  })
  .refine((env) => env.NODE_ENV !== 'production' || !env.WEBHOOK_SECRET.startsWith('change-me'), {
    message: 'WEBHOOK_SECRET must not use a placeholder value in production',
    path: ['WEBHOOK_SECRET'],
  })
  .refine(minioProductionRefinement.ssl.check, minioProductionRefinement.ssl)
  .refine(minioProductionRefinement.publicEndpoint.check, minioProductionRefinement.publicEndpoint)
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' || (!!env.TOKEN_HASH_KEY && env.TOKEN_HASH_KEY.length >= 32),
    {
      message: 'TOKEN_HASH_KEY is required and must be at least 32 characters in production',
      path: ['TOKEN_HASH_KEY'],
    },
  );

export type EnvConfig = z.infer<typeof envSchema>;
