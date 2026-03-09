import { baseEnvSchema, minioEnvSchema, minioProductionRefinement } from '@assertly/nestjs-common';
import { z } from 'zod';

export const envSchema = baseEnvSchema
  .extend({
    PORT: z.coerce.number().default(3001),
    WEBHOOK_SECRET: z.string().min(32),
    DATABASE_URL: z.string().url(),
    ...minioEnvSchema.shape,
    ARTIFACT_RETENTION_DAYS: z.coerce.number().int().min(1).default(90),
  })
  .refine((env) => env.NODE_ENV !== 'production' || !env.WEBHOOK_SECRET.startsWith('change-me'), {
    message: 'WEBHOOK_SECRET must not use a placeholder value in production',
    path: ['WEBHOOK_SECRET'],
  })
  .refine(minioProductionRefinement.ssl.check, minioProductionRefinement.ssl)
  .refine(minioProductionRefinement.publicEndpoint.check, minioProductionRefinement.publicEndpoint);

export type EnvConfig = z.infer<typeof envSchema>;
