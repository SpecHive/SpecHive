export interface BaseReporterConfig {
  apiUrl?: string;
  projectToken?: string;
  enabled?: boolean;
  maxRetries?: number;
  flushTimeout?: number;
  failOnConnectionError?: boolean;
  metadata?: Record<string, unknown>;
  runName?: string;
}
