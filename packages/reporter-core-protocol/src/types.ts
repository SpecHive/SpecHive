import type { RunId } from '@assertly/shared-types';

export interface EventEnvelope<T> {
  version: string;
  eventType: string;
  timestamp: string; // ISO 8601
  runId: RunId;
  payload: T;
}
