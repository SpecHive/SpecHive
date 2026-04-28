import { baseEnvSchema, minioEnvSchema, minioProductionRefinement } from '@spechive/nestjs-common';
import { z } from 'zod';

export const workerEnvShape = baseEnvSchema.extend({
  PORT: z.coerce.number().default(3002),
  SERVICE_NAME: z.string().min(1).default('worker'),
  WEBHOOK_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  ...minioEnvSchema.shape,
  ARTIFACT_RETENTION_DAYS: z.coerce.number().int().min(1).default(90),
});

type WorkerEnv = z.infer<typeof workerEnvShape>;

export function applyWorkerRefinements<T extends WorkerEnv>(schema: z.ZodType<T>) {
  return schema
    .refine(
      (env) => env.NODE_ENV !== 'production' || !String(env.WEBHOOK_SECRET).startsWith('change-me'),
      {
        message: 'WEBHOOK_SECRET must not use a placeholder value in production',
        path: ['WEBHOOK_SECRET'],
      },
    )
    .refine(minioProductionRefinement.ssl.check, minioProductionRefinement.ssl)
    .refine(
      minioProductionRefinement.publicEndpoint.check,
      minioProductionRefinement.publicEndpoint,
    );
}

export const envSchema = applyWorkerRefinements(workerEnvShape);

export type EnvConfig = z.infer<typeof workerEnvShape>;
