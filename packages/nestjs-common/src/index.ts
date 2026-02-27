export { AllExceptionsFilter } from './filters/all-exceptions.filter';
export { baseEnvSchema } from './config/base-env.schema';
export type { BaseEnvConfig } from './config/base-env.schema';
export { createConfigModule } from './config/config.module';
export { HealthModule } from './health/health.module';
export { bootstrapNestApp } from './bootstrap/bootstrap-app';
export type { BootstrapOptions } from './bootstrap/bootstrap-app';
export { isProductionEnv } from './utils/env-helpers';
export { throwZodBadRequest } from './utils/zod-error';
export { GLOBAL_RATE_LIMIT_TTL_MS } from './utils/rate-limit';
export { ThrottlerBehindProxyGuard } from './guards/throttler-behind-proxy.guard';

// Centralised injection token — import this symbol in both ingestion-api and worker
// instead of defining local Symbols, so the same reference is always used.
export const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');
