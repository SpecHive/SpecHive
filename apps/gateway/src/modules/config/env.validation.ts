import { baseEnvSchema } from '@spechive/nestjs-common';
import { z } from 'zod';

export const gatewayEnvShape = baseEnvSchema.extend({
  PORT: z.coerce.number().default(3003),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  INGESTION_API_URL: z.string().url().default('http://localhost:3000'),
  QUERY_API_URL: z.string().url().default('http://localhost:3002'),
});

type GatewayEnv = z.infer<typeof gatewayEnvShape>;

export function applyGatewayRefinements<T extends GatewayEnv>(schema: z.ZodType<T>) {
  return schema
    .refine((env) => env.NODE_ENV !== 'production' || String(env.JWT_SECRET).length >= 64, {
      message: 'JWT_SECRET must be at least 64 characters in production',
      path: ['JWT_SECRET'],
    })
    .refine(
      (env) => env.NODE_ENV !== 'production' || !String(env.CORS_ORIGIN).includes('localhost'),
      {
        message: 'CORS_ORIGIN must not contain localhost in production',
        path: ['CORS_ORIGIN'],
      },
    );
}

export const envSchema = applyGatewayRefinements(gatewayEnvShape);

export type EnvConfig = z.infer<typeof gatewayEnvShape>;
