import type { BaseReporterConfig } from './types.js';

export const CLOUD_API_URL = 'https://api.spechive.dev';
export const MAX_ERROR_MESSAGE_LENGTH = 10_000;
export const MAX_STACK_TRACE_LENGTH = 50_000;

export interface BaseResolvedConfig {
  apiUrl: string;
  projectToken: string;
  enabled: boolean;
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

export function resolveBaseConfig(config: BaseReporterConfig): BaseResolvedConfig {
  const apiUrl = config.apiUrl || process.env.SPECHIVE_API_URL || CLOUD_API_URL;
  const projectToken = config.projectToken ?? process.env.SPECHIVE_PROJECT_TOKEN;
  const enabled = config.enabled ?? parseBoolean(process.env.SPECHIVE_ENABLED, true);

  const base = {
    maxRetries: config.maxRetries ?? 3,
    flushTimeout: config.flushTimeout ?? 30_000,
    failOnConnectionError: config.failOnConnectionError ?? false,
    metadata: config.metadata ?? {},
    runName: config.runName ?? process.env.SPECHIVE_RUN_NAME ?? undefined,
  };

  if (!projectToken) {
    if (enabled) {
      console.warn(
        '[spechive] Reporter disabled: missing projectToken. ' +
          'Set SPECHIVE_PROJECT_TOKEN env var, or pass it in reporter config.',
      );
    }
    return { ...base, apiUrl: '', projectToken: '', enabled: false };
  }

  return { ...base, apiUrl, projectToken, enabled };
}
