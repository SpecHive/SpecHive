import { SEED_ORG_ID, SEED_PROJECT_ID } from '../constants';

interface WebhookEventOverrides {
  eventId?: string;
  aggregateType?: string;
  aggregateId?: string;
  eventType?: string;
  payload?: Record<string, unknown>;
}

/**
 * Create a webhook batch payload matching the Outboxy envelope format.
 * This is used by the worker's webhook receiver.
 */
export function createWebhookPayload(overrides: WebhookEventOverrides = {}): string {
  return JSON.stringify({
    batch: true,
    count: 1,
    events: [
      {
        eventId: overrides.eventId ?? crypto.randomUUID(),
        aggregateType: overrides.aggregateType ?? 'TestRun',
        aggregateId: overrides.aggregateId ?? 'run-1',
        eventType: overrides.eventType ?? 'run.start',
        payload: overrides.payload ?? { runId: 'run-1' },
        ...overrides,
      },
    ],
  });
}

/**
 * Create a webhook payload with a proper inner event envelope.
 * Matches the format used by the actual Outboxy pipeline (event nested inside payload).
 */
export function createWebhookEventPayload(
  eventType: string,
  runId: string,
  innerPayload: Record<string, unknown>,
  options?: {
    eventId?: string;
    organizationId?: string;
    projectId?: string;
  },
): string {
  const event = {
    eventId: options?.eventId ?? crypto.randomUUID(),
    aggregateType: 'TestRun',
    aggregateId: runId,
    eventType,
    payload: {
      event: {
        version: '1',
        timestamp: new Date().toISOString(),
        runId,
        eventType,
        payload: innerPayload,
      },
      organizationId: options?.organizationId ?? SEED_ORG_ID,
      projectId: options?.projectId ?? SEED_PROJECT_ID,
    },
    createdAt: new Date().toISOString(),
  };

  return JSON.stringify({
    batch: true,
    count: 1,
    events: [event],
  });
}
