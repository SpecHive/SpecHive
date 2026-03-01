import { baseEnvSchema, minioEnvSchema, minioProductionRefinement } from '@assertly/nestjs-common';
import { z } from 'zod';

export const envSchema = baseEnvSchema
  .extend({
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(1),
    JWT_EXPIRES_IN: z.string().default('24h'),
    CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
    ...minioEnvSchema.shape,
  })
  .refine((env) => env.NODE_ENV !== 'production' || !env.CORS_ORIGIN.includes('localhost'), {
    message: 'CORS_ORIGIN must not contain localhost in production',
    path: ['CORS_ORIGIN'],
  })
  .refine(minioProductionRefinement.ssl.check, minioProductionRefinement.ssl)
  .refine((env) => env.NODE_ENV !== 'production' || env.JWT_SECRET.length >= 64, {
    message: 'JWT_SECRET must be at least 64 characters in production',
    path: ['JWT_SECRET'],
  });

export type EnvConfig = z.infer<typeof envSchema>;
