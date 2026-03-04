import { z } from 'zod';

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  S3_REGION: z.string().default('us-east-1'),
});

export type BaseEnvConfig = z.infer<typeof baseEnvSchema>;
