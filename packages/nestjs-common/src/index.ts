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
export { escapeLikePattern } from './utils/like-escape';
export { sanitizeServiceName } from './utils/sanitize-service-name';
export { extractPgError, DEFAULT_RETRYABLE_PG_CODES } from './utils/pg-error';
export type { PgErrorInfo } from './utils/pg-error';
export { RetryableError } from './errors/retryable.error';
export { parseExpiry, parseExpirySeconds } from './utils/parse-expiry';
export { IS_PRODUCTION, isProductionProvider } from './providers/is-production.provider';
export { IsProductionModule } from './providers/is-production.module';
export { throwZodBadRequest } from './utils/zod-error';
export { ZodValidationPipe } from './pipes/zod-validation.pipe';
export { GLOBAL_RATE_LIMIT_TTL_MS } from './utils/rate-limit';
export { ThrottlerBehindProxyGuard } from './guards/throttler-behind-proxy.guard';

export {
  DATABASE_CONNECTION,
  INTERNAL_ROUTE_PATHS,
  IS_PUBLIC_KEY,
  REDIS_CLIENT,
} from './constants';

export { DatabaseModule } from './database/database.module';
export { DatabaseShutdownService } from './database/database-shutdown.service';

export { S3Module } from './s3/s3.module';
export { S3Service } from './s3/s3.service';
export { S3_CLIENT, S3_BUCKET } from './s3/s3.constants';
export type { S3ModuleConfig } from './s3/s3.constants';
export { createS3ModuleOptions } from './s3/s3.factory';
export type { S3FactoryEnvConfig } from './s3/s3.factory';

export { createLoggerModule } from './logger/create-logger-module';
export { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

export { createOutboxyAdapter, createOutboxyModuleConfig } from './outboxy/index';

export { JwtAuthGuard, RolesGuard, CurrentUser, Public, Roles, ROLES_KEY } from './auth/index';
export { JwtPayloadSchema } from './auth/index';
export type { JwtPayload, UserContext } from './auth/index';
export { ProjectTokenGuard } from './auth/index';
export type { ProjectContext } from './auth/index';
export { GatewayTrustGuard } from './auth/index';

export {
  METRICS_PORT,
  METRICS_SERVICE,
  DEFAULT_HISTOGRAM_BUCKETS,
  MetricsModule,
  MetricsService,
  MetricsInterceptor,
  DbMetricsService,
} from './metrics';
export type { MetricsModuleOptions } from './metrics';
