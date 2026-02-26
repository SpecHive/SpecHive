export { AllExceptionsFilter } from './filters/all-exceptions.filter';
export { baseEnvSchema } from './config/base-env.schema';
export type { BaseEnvConfig } from './config/base-env.schema';
export { createConfigModule } from './config/config.module';
export { HealthModule } from './health/health.module';

// Centralised injection token — import this symbol in both ingestion-api and worker
// instead of defining local Symbols, so the same reference is always used.
export const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');
