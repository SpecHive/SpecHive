export interface AssertlyReporterConfig {
  apiUrl?: string;
  projectToken?: string;
  timeout?: number;
  enabled?: boolean;
  captureArtifacts?: boolean;
  maxRetries?: number;
  flushTimeout?: number;
  failOnConnectionError?: boolean;
  metadata?: Record<string, unknown>;
}
