export { AllExceptionsFilter } from './filters/all-exceptions.filter';
export { baseEnvSchema } from './config/base-env.schema';
export type { BaseEnvConfig } from './config/base-env.schema';
export { minioEnvSchema, minioProductionRefinement } from './config/minio.schema';
export type { MinioEnvConfig } from './config/minio.schema';
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

export { S3Module } from './s3/s3.module';
export { S3Service } from './s3/s3.service';
export { S3_CLIENT, S3_BUCKET } from './s3/s3.constants';
export type { S3ModuleConfig } from './s3/s3.constants';
export { createS3ModuleOptions } from './s3/s3.factory';
export type { S3FactoryEnvConfig } from './s3/s3.factory';
