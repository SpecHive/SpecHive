import { createLogger } from './logger.js';
import type { LogLevel, Logger } from './logger.js';
import type { BaseReporterConfig } from './types.js';

export const CLOUD_API_URL = 'https://api.spechive.dev';
export const MAX_STACK_TRACE_LENGTH = 50_000;

const VALID_LOG_LEVELS = new Set<string>(['silent', 'error', 'warn', 'info']);

export interface BaseResolvedConfig {
  apiUrl: string;
  projectToken: string;
  enabled: boolean;
  logLevel: LogLevel;
  logger: Logger;
  maxRetries: number;
  flushTimeout: number;
  failOnConnectionError: boolean;
  metadata: Record<string, unknown>;
  runName: string | undefined;
}

export function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1';
}

function resolveLogLevel(config: BaseReporterConfig): LogLevel {
  if (config.logLevel !== undefined) return config.logLevel;
  const env = process.env.SPECHIVE_LOG_LEVEL?.toLowerCase().trim();
  if (env && VALID_LOG_LEVELS.has(env)) return env as LogLevel;
  return 'warn';
}

export function resolveBaseConfig(config: BaseReporterConfig): BaseResolvedConfig {
  const apiUrl = config.apiUrl || process.env.SPECHIVE_API_URL || CLOUD_API_URL;
  const projectToken = config.projectToken ?? process.env.SPECHIVE_PROJECT_TOKEN;
  const enabled = config.enabled ?? parseBoolean(process.env.SPECHIVE_ENABLED, true);
  const logLevel = resolveLogLevel(config);
  const logger = createLogger(logLevel);

  const base = {
    logLevel,
    logger,
    maxRetries: config.maxRetries ?? 3,
    flushTimeout: config.flushTimeout ?? 30_000,
    failOnConnectionError: config.failOnConnectionError ?? false,
    metadata: config.metadata ?? {},
    runName: config.runName ?? process.env.SPECHIVE_RUN_NAME ?? undefined,
  };

  if (!projectToken) {
    if (enabled) {
      logger.warn(
        '[spechive] Reporter disabled: missing projectToken. ' +
          'Set SPECHIVE_PROJECT_TOKEN env var, or pass it in reporter config.',
      );
    }
    return { ...base, apiUrl: '', projectToken: '', enabled: false };
  }

  return { ...base, apiUrl, projectToken, enabled };
}
