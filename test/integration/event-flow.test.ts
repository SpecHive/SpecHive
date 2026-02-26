/**
 * End-to-end event flow integration test.
 *
 * Verifies the full ingest pipeline: send events to the ingestion API and
 * verify DB state. Requires the full Docker Compose stack running:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
 *
 * Run with:
 *   pnpm test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const INGESTION_API_URL = process.env['INGESTION_API_URL'] ?? 'http://localhost:3000';
const PROJECT_TOKEN = process.env['PROJECT_TOKEN'] ?? 'test-token';

const DATABASE_URL =
  process.env['ADMIN_DATABASE_URL'] ??
  (() => {
    const user = process.env['POSTGRES_USER'] ?? 'assertly';
    const pass = process.env['POSTGRES_PASSWORD'] ?? 'assertly';
    const db = process.env['POSTGRES_DB'] ?? 'assertly';
    return `postgres://${user}:${pass}@localhost:5432/${db}`;
  })();

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- dynamic import requires value-level typeof
let postgres: typeof import('postgres').default;

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

const RUN_ID = crypto.randomUUID();
const VALID_TIMESTAMP = new Date().toISOString();

describe('End-to-end event flow', () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    const mod = await import('postgres');
    postgres = mod.default;
    sql = postgres(DATABASE_URL, { max: 1 });

    await waitForService(INGESTION_API_URL);
  }, 30_000);

  afterAll(async () => {
    // Clean up seeded run data
    await sql`DELETE FROM runs WHERE id = ${RUN_ID}`;
    await sql.end();
  });

  it('ingests a run.start event and creates a run record', async () => {
    const response = await fetch(`${INGESTION_API_URL}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-project-token': PROJECT_TOKEN,
      },
      body: JSON.stringify({
        version: '1',
        timestamp: VALID_TIMESTAMP,
        runId: RUN_ID,
        eventType: 'run.start',
        payload: {},
      }),
    });

    expect(response.status).toBe(202);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('runId', RUN_ID);

    // Verify run exists in DB (superuser bypasses RLS)
    const [run] = await sql`SELECT id, status FROM runs WHERE id = ${RUN_ID}`;
    expect(run).toBeDefined();
    expect(run!.status).toBe('pending');
  });

  it('ingests a run.end event and updates the run status', async () => {
    const response = await fetch(`${INGESTION_API_URL}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-project-token': PROJECT_TOKEN,
      },
      body: JSON.stringify({
        version: '1',
        timestamp: new Date().toISOString(),
        runId: RUN_ID,
        eventType: 'run.end',
        payload: { status: 'passed' },
      }),
    });

    expect(response.status).toBe(202);

    // Verify run status was updated
    const [run] = await sql`SELECT id, status, finished_at FROM runs WHERE id = ${RUN_ID}`;
    expect(run).toBeDefined();
    expect(run!.status).toBe('passed');
    expect(run!.finished_at).not.toBeNull();
  });

  it('rejects events without a project token', async () => {
    const response = await fetch(`${INGESTION_API_URL}/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: '1',
        timestamp: VALID_TIMESTAMP,
        runId: crypto.randomUUID(),
        eventType: 'run.start',
        payload: {},
      }),
    });

    expect(response.status).toBe(401);
  });

  it('rejects events with an invalid token', async () => {
    const response = await fetch(`${INGESTION_API_URL}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-project-token': 'invalid-token-that-does-not-exist',
      },
      body: JSON.stringify({
        version: '1',
        timestamp: VALID_TIMESTAMP,
        runId: crypto.randomUUID(),
        eventType: 'run.start',
        payload: {},
      }),
    });

    expect(response.status).toBe(401);
  });
});
