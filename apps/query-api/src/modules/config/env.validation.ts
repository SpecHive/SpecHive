import { baseEnvSchema, minioEnvSchema, minioProductionRefinement } from '@assertly/nestjs-common';
import { z } from 'zod';

export const envSchema = baseEnvSchema
  .extend({
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(16),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
    DASHBOARD_URL: z.string().url().optional(),
    ...minioEnvSchema.shape,
  })
  .refine((env) => env.NODE_ENV !== 'production' || !env.CORS_ORIGIN.includes('localhost'), {
    message: 'CORS_ORIGIN must not contain localhost in production',
    path: ['CORS_ORIGIN'],
  })
  .refine(minioProductionRefinement.ssl.check, minioProductionRefinement.ssl)
  .refine(minioProductionRefinement.publicEndpoint.check, minioProductionRefinement.publicEndpoint)
  .refine((env) => env.NODE_ENV !== 'production' || env.JWT_SECRET.length >= 64, {
    message: 'JWT_SECRET must be at least 64 characters in production',
    path: ['JWT_SECRET'],
  })
  .refine((env) => env.NODE_ENV !== 'production' || !!env.DASHBOARD_URL, {
    message: 'DASHBOARD_URL is required in production',
    path: ['DASHBOARD_URL'],
  });

export type EnvConfig = z.infer<typeof envSchema>;
