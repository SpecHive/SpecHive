export const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Routes excluded from request logging and metrics recording.
 * Single source of truth — used by MetricsInterceptor and createLoggerModule.
 *
 * SSE is excluded because long-lived connections skew duration histograms and spam request logs.
 */
export const INTERNAL_ROUTE_PATHS = ['/health', '/health/ready', '/v1/sse/events'] as const;
