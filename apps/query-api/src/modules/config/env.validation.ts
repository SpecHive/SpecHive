import { baseEnvSchema, minioEnvSchema, minioProductionRefinement } from '@spechive/nestjs-common';
import { z } from 'zod';

export const queryApiEnvShape = baseEnvSchema.extend({
  PORT: z.coerce.number().default(3003),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  REDIS_URL: z.string().url(),
  ...minioEnvSchema.shape,
});

type QueryApiEnv = z.infer<typeof queryApiEnvShape>;

export function applyQueryApiRefinements<T extends QueryApiEnv>(schema: z.ZodType<T>) {
  return schema
    .refine(
      (env) => env.NODE_ENV !== 'production' || !String(env.CORS_ORIGIN).includes('localhost'),
      {
        message: 'CORS_ORIGIN must not contain localhost in production',
        path: ['CORS_ORIGIN'],
      },
    )
    .refine(minioProductionRefinement.ssl.check, minioProductionRefinement.ssl)
    .refine(
      minioProductionRefinement.publicEndpoint.check,
      minioProductionRefinement.publicEndpoint,
    )
    .refine((env) => env.NODE_ENV !== 'production' || String(env.JWT_SECRET).length >= 64, {
      message: 'JWT_SECRET must be at least 64 characters in production',
      path: ['JWT_SECRET'],
    });
}

export const envSchema = applyQueryApiRefinements(queryApiEnvShape);

export type EnvConfig = z.infer<typeof queryApiEnvShape>;
