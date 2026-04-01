import type { LogLevel } from './logger.js';

export interface BaseReporterConfig {
  apiUrl?: string;
  projectToken?: string;
  enabled?: boolean;
  /**
   * Controls reporter log verbosity. Levels (cumulative):
   * - `'silent'` — no output
   * - `'error'`  — only data-loss issues (e.g. artifact too large)
   * - `'warn'`   — failures, retries, health-check issues (**default**)
   * - `'info'`   — everything above + run-complete summary
   *
   * Override via `SPECHIVE_LOG_LEVEL` env var without changing code.
   */
  logLevel?: LogLevel;
  maxRetries?: number;
  flushTimeout?: number;
  failOnConnectionError?: boolean;
  metadata?: Record<string, unknown>;
  runName?: string;
}
