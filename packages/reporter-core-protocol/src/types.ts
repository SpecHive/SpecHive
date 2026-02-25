export interface EventEnvelope<T> {
  version: string;
  eventType: string;
  timestamp: string; // ISO 8601
  runId: string;
  payload: T;
}
