import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  WORKER_WEBHOOK_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  OUTBOXY_API_URL: z.string().url().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(`Invalid environment configuration: ${JSON.stringify(formatted, null, 2)}`);
  }

  return result.data;
}
