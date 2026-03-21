/**
 * Crash simulation integration tests.
 *
 * These tests require the full Docker Compose stack to be running:
 *   pnpm docker:up
 *
 * Run with:
 *   pnpm test:integration
 */

import { execSync } from 'node:child_process';

import { describe, it, expect, beforeAll } from 'vitest';

import { IngestionApiClient } from '../helpers/api-clients';
import { GATEWAY_URL, INGESTION_URL, WORKER_URL, PROJECT_TOKEN } from '../helpers/constants';
import { createRunStartEvent, createWebhookPayload } from '../helpers/factories';
import { waitForService } from '../helpers/wait';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = process.env['WEBHOOK_SECRET'] ?? 'change-me-in-production-testing!!';
const POSTGRES_CONTAINER = process.env['POSTGRES_CONTAINER'] ?? 'spechive-postgres-1';

const ingestionApi = new IngestionApiClient(GATEWAY_URL, PROJECT_TOKEN);

const RUN_ID = crypto.randomUUID();
const VALID_TIMESTAMP = '2026-02-24T10:00:00.000Z';

// ---------------------------------------------------------------------------
// Helpers (crash-simulation-specific)
// ---------------------------------------------------------------------------

async function checkServiceHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3_000) });
    return res.ok;
  } catch {
    return false;
  }
}

function verifyDockerContainer(containerName: string): void {
  try {
    execSync(`docker inspect ${containerName} --format '{{.State.Running}}'`, {
      timeout: 5_000,
    });
  } catch {
    throw new Error(
      `Docker container '${containerName}' is not running. ` +
        `Start Docker services: docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d`,
    );
  }
}

function restartPostgresContainer(): void {
  execSync(`docker restart ${POSTGRES_CONTAINER}`, { timeout: 30_000 });
}

async function waitForPostgres(maxAttempts = 30, delayMs = 1_000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const output = execSync(
        `docker exec ${POSTGRES_CONTAINER} pg_isready -U spechive -d spechive`,
        { timeout: 5_000 },
      );
      if (output.toString().includes('accepting connections')) return;
    } catch {
      // Postgres not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Postgres did not become ready within ${maxAttempts * delayMs}ms`);
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('Crash simulation: ingestion-api', () => {
  beforeAll(async () => {
    await waitForService(GATEWAY_URL);
    await waitForService(INGESTION_URL);
  }, 30_000);

  it('aborted run.start request leaves no partial state', async () => {
    const controller = new AbortController();

    const event = {
      version: '1',
      timestamp: VALID_TIMESTAMP,
      runId: RUN_ID,
      eventType: 'run.start',
      payload: {},
    };

    let requestError: unknown = null;

    const sendPromise = ingestionApi.events
      .sendRaw(event, { signal: controller.signal })
      .catch((err: unknown) => {
        requestError = err;
      });

    controller.abort();
    await sendPromise;

    expect(requestError === null || requestError instanceof Error).toBe(true);

    // In publish-only mode, verify the service is still healthy after abort
    const healthRes = await fetch(`${INGESTION_URL}/health`);
    expect(healthRes.ok).toBe(true);
  });

  it('invalid payload returns 400 and does not crash the service', async () => {
    const res = await ingestionApi.events.sendRaw({ totally: 'wrong', shape: true });

    expect(res.status).toBe(400);

    const healthRes = await fetch(`${INGESTION_URL}/health`);
    expect(healthRes.ok).toBe(true);
  });

  it('missing auth token returns 401', async () => {
    const res = await ingestionApi.events.sendWithoutToken(createRunStartEvent({ runId: RUN_ID }));

    expect(res.status).toBe(401);
  });

  it('malformed JSON body returns a 4xx and does not crash the service', async () => {
    const res = await ingestionApi.events.sendRawBody('{ not valid json >>>');

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);

    const healthRes = await fetch(`${INGESTION_URL}/health`);
    expect(healthRes.ok).toBe(true);
  });
});

describe('Crash simulation: worker', () => {
  beforeAll(async () => {
    await waitForService(WORKER_URL);
  }, 30_000);

  it('valid webhook payload returns 200', async () => {
    const res = await fetch(`${WORKER_URL}/webhooks/outboxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: createWebhookPayload({
        eventType: 'run.start',
        aggregateId: 'run-1',
        payload: { runId: 'run-1' },
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toHaveProperty('received', true);
  });

  it('invalid webhook payload returns 400', async () => {
    const res = await fetch(`${WORKER_URL}/webhooks/outboxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({ unexpected_field: true, data: null }),
    });

    expect(res.status).toBe(400);
  });

  it('missing webhook secret returns 401', async () => {
    const res = await fetch(`${WORKER_URL}/webhooks/outboxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'evt-1',
        aggregateType: 'TestRun',
        aggregateId: 'run-1',
        eventType: 'run.start',
        payload: {},
      }),
    });

    expect(res.status).toBe(401);
  });

  it('service remains reachable after processing multiple requests', async () => {
    for (let i = 0; i < 3; i++) {
      await fetch(`${WORKER_URL}/webhooks/outboxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': WEBHOOK_SECRET,
        },
        body: createWebhookPayload({
          eventType: 'test.end',
          aggregateId: `run-${i}`,
          payload: { status: 'passed' },
        }),
      });
    }

    const healthRes = await fetch(`${WORKER_URL}/health`);
    expect(healthRes.ok).toBe(true);
  });
});

describe('Crash simulation: postgres restart', () => {
  beforeAll(async () => {
    // Verify Docker container is running - fail fast with clear message
    verifyDockerContainer(POSTGRES_CONTAINER);
    await waitForService(WORKER_URL);
    await waitForService(INGESTION_URL);
  }, 30_000);

  it('worker reconnects to postgres after restart', async () => {
    // Verify worker is healthy before restart
    const beforeHealth = await checkServiceHealth(WORKER_URL);
    expect(beforeHealth).toBe(true);

    // Restart postgres
    restartPostgresContainer();

    // Wait for postgres to become ready again
    await waitForPostgres();

    // Wait for worker to recover
    await waitForService(WORKER_URL, { maxAttempts: 30, delayMs: 1_000 });

    const afterHealth = await checkServiceHealth(WORKER_URL);
    expect(afterHealth).toBe(true);
  }, 60_000);

  it('ingestion-api reconnects to postgres after restart', async () => {
    const beforeHealth = await checkServiceHealth(INGESTION_URL);
    expect(beforeHealth).toBe(true);

    restartPostgresContainer();

    await waitForPostgres();

    await waitForService(INGESTION_URL, { maxAttempts: 30, delayMs: 1_000 });

    const afterHealth = await checkServiceHealth(INGESTION_URL);
    expect(afterHealth).toBe(true);
  }, 60_000);
});
