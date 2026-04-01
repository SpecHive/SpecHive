import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { IngestionApiClient } from '../helpers/api-clients';
import { GATEWAY_URL, PROJECT_TOKEN, WORKER_URL } from '../helpers/constants';
import { buildSuperuserDatabaseUrl, createPostgresConnection } from '../helpers/database';
import { createRunStartEvent } from '../helpers/factories';
import { createWebhookEventPayload } from '../helpers/factories/webhook.factory';
import { waitForService, waitForRow } from '../helpers/wait';

const WORKER_WEBHOOK_URL = `${WORKER_URL}/webhooks/outboxy`;

const WEBHOOK_SECRET = process.env['WEBHOOK_SECRET'] ?? 'change-me-in-production-min-32ch';

const ingestionApi = new IngestionApiClient(GATEWAY_URL, PROJECT_TOKEN);

/** Send a webhook event directly to the worker endpoint. */
async function sendWebhookEvent(
  eventType: string,
  runId: string,
  payload: Record<string, unknown>,
  options: { webhookSecret?: string; rawBody?: string } = {},
): Promise<{ status: number; body: unknown }> {
  const rawBody = options.rawBody ?? createWebhookEventPayload(eventType, runId, payload);

  const response = await fetch(WORKER_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': options.webhookSecret ?? WEBHOOK_SECRET,
    },
    body: rawBody,
  });

  const body = await response.json().catch(() => ({ error: 'Invalid JSON response' }));

  return { status: response.status, body };
}

/** Create a run via the ingestion pipeline and wait for it to appear in DB. */
async function createRunViaIngestion(
  sql: Awaited<ReturnType<typeof createPostgresConnection>>,
  runId: string,
): Promise<void> {
  await ingestionApi.events.send(createRunStartEvent({ runId }));

  await waitForRow(() => sql`SELECT * FROM runs WHERE id = ${runId}`);
}

describe('Worker error handling', () => {
  let sql: Awaited<ReturnType<typeof createPostgresConnection>>;

  beforeAll(async () => {
    sql = await createPostgresConnection(buildSuperuserDatabaseUrl());
    await waitForService(GATEWAY_URL);
    await waitForService(WORKER_URL);
  }, 30_000);

  afterAll(async () => {
    await sql.end();
  });

  describe('Webhook authentication', () => {
    it('rejects webhook without secret header', async () => {
      const response = await fetch(WORKER_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: createWebhookEventPayload('run.start', crypto.randomUUID(), {}),
      });

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('message', 'Invalid webhook secret');
    });

    it('rejects webhook with incorrect secret', async () => {
      const response = await fetch(WORKER_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': 'incorrect-secret-value',
        },
        body: createWebhookEventPayload('run.start', crypto.randomUUID(), {}),
      });

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('message', 'Invalid webhook secret');
    });
  });

  describe('Payload validation', () => {
    it('rejects malformed JSON in webhook body', async () => {
      const response = await fetch(WORKER_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': WEBHOOK_SECRET,
        },
        body: '{invalid-json',
      });

      expect(response.status).toBe(400);
    });

    it('rejects webhook payload missing required fields', async () => {
      const response = await fetch(WORKER_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': WEBHOOK_SECRET,
        },
        body: JSON.stringify({ missing: 'fields' }),
      });

      expect(response.status).toBe(400);

      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toHaveProperty('message');
      expect(body['message']).toContain('Invalid webhook payload');
    });

    it('rejects webhook payload with invalid field types', async () => {
      const response = await fetch(WORKER_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          batch: true,
          count: 1,
          events: [
            {
              eventId: 123, // Should be string
              aggregateType: 'run',
              aggregateId: 'some-id',
              eventType: 'run.start',
              payload: {},
            },
          ],
        }),
      });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body).toHaveProperty('message');
    });
  });

  describe('Event processing errors', () => {
    it('handles test.end for non-existent test gracefully', async () => {
      const runId = crypto.randomUUID();
      const nonExistentTestId = crypto.randomUUID();

      await createRunViaIngestion(sql, runId);

      const result = await sendWebhookEvent('test.end', runId, {
        testId: nonExistentTestId,
        status: 'passed',
        durationMs: 100,
      });

      // Handler throws RetryableError when test row not found → 500 PARTIAL_BATCH_FAILURE
      expect(result.status).toBe(500);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      const testRows = await sql`SELECT * FROM tests WHERE id = ${nonExistentTestId}`;
      expect(testRows).toHaveLength(0);
    }, 30_000);

    it('handles suite.end for non-existent suite gracefully', async () => {
      const runId = crypto.randomUUID();
      const nonExistentSuiteId = crypto.randomUUID();

      await createRunViaIngestion(sql, runId);

      const result = await sendWebhookEvent('suite.end', runId, {
        suiteId: nonExistentSuiteId,
      });

      expect(result.status).toBe(200);
    }, 30_000);
  });

  describe('Database constraint violations', () => {
    it('rolls back partial suite on constraint violation (duplicate suite name in run)', async () => {
      const runId = crypto.randomUUID();
      const suiteId1 = crypto.randomUUID();
      const suiteId2 = crypto.randomUUID();
      const suiteName = 'Duplicate Suite Name';

      await createRunViaIngestion(sql, runId);

      await sendWebhookEvent('suite.start', runId, {
        suiteId: suiteId1,
        suiteName,
      });

      await waitForRow(() => sql`SELECT * FROM suites WHERE id = ${suiteId1}`);

      const result = await sendWebhookEvent('suite.start', runId, {
        suiteId: suiteId2,
        suiteName,
      });

      // onConflictDoNothing() silently ignores duplicate suite names
      expect(result.status).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const suiteRows = await sql`
        SELECT * FROM suites WHERE run_id = ${runId} AND name = ${suiteName}
      `;
      expect(suiteRows).toHaveLength(1);
      expect(suiteRows[0]?.id).toBe(suiteId1);

      const suite2Rows = await sql`SELECT * FROM suites WHERE id = ${suiteId2}`;
      expect(suite2Rows).toHaveLength(0);
    }, 30_000);
  });

  describe('Invalid event envelopes', () => {
    it('accepts webhook but logs error for malformed event envelope', async () => {
      const eventId = crypto.randomUUID();

      const result = await sendWebhookEvent(
        'run.start',
        crypto.randomUUID(),
        {},
        {
          rawBody: JSON.stringify({
            batch: true,
            count: 1,
            events: [
              {
                eventId,
                aggregateType: 'run',
                aggregateId: 'some-run-id',
                eventType: 'run.start',
                payload: {
                  // Invalid event envelope - missing required fields
                  version: '1',
                },
              },
            ],
          }),
        },
      );

      // Outboxy envelope is valid but inner event is malformed — logged and acknowledged
      expect(result.status).toBe(200);
    });

    it('handles unknown event types gracefully', async () => {
      const runId = crypto.randomUUID();

      await createRunViaIngestion(sql, runId);

      const result = await sendWebhookEvent('unknown.event' as never, runId, {});

      expect(result.status).toBe(200);
    }, 30_000);
  });
});
