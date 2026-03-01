export interface AssertlyReporterConfig {
  apiUrl: string;
  projectToken: string;
  batchSize?: number;
  timeout?: number;
  enabled?: boolean;
}

export interface QueuedEvent {
  eventType: string;
  timestamp: string;
}
