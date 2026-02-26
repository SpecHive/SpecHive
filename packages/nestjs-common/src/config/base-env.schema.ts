import { z } from 'zod';

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  TOKEN_HASH_KEY: z.string().min(32),
});

export type BaseEnvConfig = z.infer<typeof baseEnvSchema>;
