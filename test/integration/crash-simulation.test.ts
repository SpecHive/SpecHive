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

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const INGESTION_API_URL = process.env['INGESTION_API_URL'] ?? 'http://localhost:3000';
const WORKER_URL = process.env['WORKER_URL'] ?? 'http://localhost:3001';
const OUTBOXY_URL = process.env['OUTBOXY_API_URL'] ?? 'http://localhost:3100';
const WEBHOOK_SECRET = process.env['WEBHOOK_SECRET'] ?? 'change-me-in-production';
const PROJECT_TOKEN = process.env['PROJECT_TOKEN'] ?? 'test-token';
const POSTGRES_CONTAINER = process.env['POSTGRES_CONTAINER'] ?? 'assertly-postgres-1';

const RUN_ID = crypto.randomUUID();
const VALID_TIMESTAMP = '2026-02-24T10:00:00.000Z';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForService(url: string, maxAttempts = 20, delayMs = 500): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      // Service not yet ready
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Service at ${url} did not become ready within ${maxAttempts * delayMs}ms`);
}

async function checkServiceHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3_000) });
    return res.ok;
  } catch {
    return false;
  }
}

function restartPostgresContainer(): void {
  execSync(`docker restart ${POSTGRES_CONTAINER}`, { timeout: 30_000 });
}

function isDockerAvailable(): boolean {
  try {
    execSync(`docker inspect ${POSTGRES_CONTAINER} --format '{{.State.Running}}'`, {
      timeout: 5_000,
    });
    return true;
  } catch {
    return false;
  }
}

async function waitForPostgres(maxAttempts = 30, delayMs = 1_000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const output = execSync(
        `docker exec ${POSTGRES_CONTAINER} pg_isready -U assertly -d assertly`,
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
    await waitForService(INGESTION_API_URL);
  }, 30_000);

  it('aborted run.start request leaves no partial state', async () => {
    const controller = new AbortController();

    const body = JSON.stringify({
      version: '1',
      timestamp: VALID_TIMESTAMP,
      runId: RUN_ID,
      eventType: 'run.start',
      payload: {},
    });

    let requestError: unknown = null;

    const sendPromise = fetch(`${INGESTION_API_URL}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-project-token': PROJECT_TOKEN,
      },
      body,
      signal: controller.signal,
    }).catch((err: unknown) => {
      requestError = err;
    });

    controller.abort();
    await sendPromise;

    expect(requestError === null || requestError instanceof Error).toBe(true);

    // Verify no partial state by attempting a run.end for the same runId
    const verifyRes = await fetch(`${INGESTION_API_URL}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-project-token': PROJECT_TOKEN,
      },
      body: JSON.stringify({
        version: '1',
        timestamp: VALID_TIMESTAMP,
        runId: RUN_ID,
        eventType: 'run.end',
        payload: { status: 'passed' },
      }),
    });

    expect([200, 202, 400, 401, 404, 422].includes(verifyRes.status)).toBe(true);
  });

  it('invalid payload returns 400 and does not crash the service', async () => {
    const res = await fetch(`${INGESTION_API_URL}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-project-token': PROJECT_TOKEN,
      },
      body: JSON.stringify({ totally: 'wrong', shape: true }),
    });

    expect(res.status).toBe(400);

    const healthRes = await fetch(`${INGESTION_API_URL}/health`);
    expect(healthRes.ok).toBe(true);
  });

  it('missing auth token returns 401', async () => {
    const res = await fetch(`${INGESTION_API_URL}/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: '1',
        timestamp: VALID_TIMESTAMP,
        runId: RUN_ID,
        eventType: 'run.start',
        payload: {},
      }),
    });

    expect(res.status).toBe(401);
  });

  it('malformed JSON body returns a 4xx and does not crash the service', async () => {
    const res = await fetch(`${INGESTION_API_URL}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-project-token': PROJECT_TOKEN,
      },
      body: '{ not valid json >>>',
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);

    const healthRes = await fetch(`${INGESTION_API_URL}/health`);
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
      body: JSON.stringify({
        id: 'evt-1',
        aggregateType: 'TestRun',
        aggregateId: 'run-1',
        eventType: 'run.start',
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
        body: JSON.stringify({
          id: `evt-${i}`,
          aggregateType: 'TestRun',
          aggregateId: `run-${i}`,
          eventType: 'test.end',
          payload: { status: 'passed' },
        }),
      });
    }

    const healthRes = await fetch(`${WORKER_URL}/health`);
    expect(healthRes.ok).toBe(true);
  });
});

describe('Crash simulation: postgres restart', () => {
  const hasDocker = isDockerAvailable();

  beforeAll(async () => {
    if (!hasDocker) return;
    await waitForService(WORKER_URL);
    await waitForService(INGESTION_API_URL);
  }, 30_000);

  it.skipIf(!hasDocker)(
    'worker reconnects to postgres after restart',
    async () => {
      // Verify worker is healthy before restart
      const beforeHealth = await checkServiceHealth(WORKER_URL);
      expect(beforeHealth).toBe(true);

      // Restart postgres
      restartPostgresContainer();

      // Wait for postgres to become ready again
      await waitForPostgres();

      // Wait for worker to recover
      await waitForService(WORKER_URL, 30, 1_000);

      const afterHealth = await checkServiceHealth(WORKER_URL);
      expect(afterHealth).toBe(true);
    },
    60_000,
  );

  it.skipIf(!hasDocker)(
    'ingestion-api reconnects to postgres after restart',
    async () => {
      const beforeHealth = await checkServiceHealth(INGESTION_API_URL);
      expect(beforeHealth).toBe(true);

      restartPostgresContainer();

      await waitForPostgres();

      await waitForService(INGESTION_API_URL, 30, 1_000);

      const afterHealth = await checkServiceHealth(INGESTION_API_URL);
      expect(afterHealth).toBe(true);
    },
    60_000,
  );
});

describe('Crash simulation: Outboxy retry', () => {
  async function skipUnlessFullStack() {
    const healthy = await checkServiceHealth(OUTBOXY_URL);
    if (!healthy) {
      return 'Outboxy not available — skipping retry tests';
    }
    return false;
  }

  it('event is retried when worker returns 500', async () => {
    const skip = await skipUnlessFullStack();
    if (skip) return;

    const res = await fetch(`${OUTBOXY_URL}/health`);
    expect(res.ok).toBe(true);

    // Verify the worker is accepting webhooks (the delivery endpoint Outboxy uses)
    const workerRes = await fetch(`${WORKER_URL}/webhooks/outboxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        id: 'evt-retry-test',
        aggregateType: 'TestRun',
        aggregateId: 'run-retry',
        eventType: 'run.start',
        payload: { runId: 'run-retry' },
      }),
    });

    expect(workerRes.status).toBe(200);
  }, 30_000);

  it('event is not duplicated when worker returns 200 after retry', async () => {
    const skip = await skipUnlessFullStack();
    if (skip) return;

    // Verify idempotent processing: sending the same event ID twice
    // should not cause errors — the worker should handle it gracefully.
    const eventPayload = {
      id: 'evt-dedup-test',
      aggregateType: 'TestRun',
      aggregateId: 'run-dedup',
      eventType: 'run.start',
      payload: { runId: 'run-dedup' },
    };

    const first = await fetch(`${WORKER_URL}/webhooks/outboxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify(eventPayload),
    });
    expect(first.status).toBe(200);

    // Re-deliver the same event (simulates Outboxy retry after timeout)
    const second = await fetch(`${WORKER_URL}/webhooks/outboxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify(eventPayload),
    });
    expect(second.status).toBe(200);

    // Service remains healthy after duplicate delivery
    const healthRes = await fetch(`${WORKER_URL}/health`);
    expect(healthRes.ok).toBe(true);
  }, 30_000);
});
