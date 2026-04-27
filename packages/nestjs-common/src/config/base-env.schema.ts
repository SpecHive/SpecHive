import { z } from 'zod';

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  SERVICE_NAME: z.string().min(1),
  /** Opt-out: metrics enabled unless explicitly set to 'false'. Gates both app metrics and Node.js runtime metrics. */
  METRICS_ENABLED: z.enum(['true', 'false']).optional(),
  /** Bind address for the /metrics server. Default '0.0.0.0' (container-internal); set to '127.0.0.1' when no private network fronts the service. */
  METRICS_BIND_ADDR: z.string().optional(),
  LOKI_HOST: z.string().optional(),
});

export type BaseEnvConfig = z.infer<typeof baseEnvSchema>;
