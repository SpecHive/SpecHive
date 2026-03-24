/**
 * End-to-end event flow integration test.
 *
 * Verifies the full ingest pipeline: send events to the ingestion API,
 * wait for the worker to process them via Outboxy, and verify domain rows
 * exist in the database. Requires the full Docker Compose stack running:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
 *
 * Run with:
 *   pnpm test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { IngestionApiClient } from '../helpers/api-clients';
import { GATEWAY_URL, PROJECT_TOKEN, SEED_TOKEN_ID } from '../helpers/constants';
import { buildSuperuserDatabaseUrl, createPostgresConnection } from '../helpers/database';
import {
  createRunStartEvent,
  createRunEndEvent,
  createSuiteStartEvent,
  createSuiteEndEvent,
  createTestStartEvent,
  createTestEndEvent,
} from '../helpers/factories';
import { waitForService, waitForRow } from '../helpers/wait';

const ingestionApi = new IngestionApiClient(GATEWAY_URL, PROJECT_TOKEN);

const RUN_ID = crypto.randomUUID();
const SUITE_ID = crypto.randomUUID();
const TEST_ID = crypto.randomUUID();

describe('End-to-end event flow', () => {
  let sql: Awaited<ReturnType<typeof createPostgresConnection>>;

  beforeAll(async () => {
    sql = await createPostgresConnection(buildSuperuserDatabaseUrl());
    await waitForService(GATEWAY_URL);
  }, 30_000);

  afterAll(async () => {
    await sql.end();
  });

  it('rejects events without a project token', async () => {
    const response = await ingestionApi.events.sendWithoutToken(createRunStartEvent());

    expect(response.status).toBe(401);
  });

  it('rejects events with an invalid token', async () => {
    const response = await ingestionApi.events.sendWithToken(
      createRunStartEvent(),
      'invalid-token-that-does-not-exist',
    );

    expect(response.status).toBe(401);
  });

  it('rejects events with a revoked project token', async () => {
    await sql`UPDATE project_tokens SET revoked_at = NOW() WHERE id = ${SEED_TOKEN_ID}`;
    try {
      const response = await ingestionApi.events.sendWithToken(
        createRunStartEvent(),
        PROJECT_TOKEN,
      );
      expect(response.status).toBe(401);
    } finally {
      await sql`UPDATE project_tokens SET revoked_at = NULL WHERE id = ${SEED_TOKEN_ID}`;
    }
  });

  it('processes a full lifecycle: run.start -> suite.start -> test.start -> test.end -> suite.end -> run.end', async () => {
    // 1. run.start
    const sendResult = await ingestionApi.events.send(
      createRunStartEvent({ runId: RUN_ID, payload: { metadata: { ci: true } } }),
    );
    expect(sendResult.status).toBe(202);

    const run = await waitForRow(() => sql`SELECT * FROM runs WHERE id = ${RUN_ID}`);
    expect(run['status']).toBe('pending');

    // 2. suite.start
    const suiteResult = await ingestionApi.events.send(
      createSuiteStartEvent({
        runId: RUN_ID,
        payload: { suiteId: SUITE_ID, suiteName: 'Auth Tests' },
      }),
    );
    expect(suiteResult.status).toBe(202);

    const suite = await waitForRow(() => sql`SELECT * FROM suites WHERE id = ${SUITE_ID}`);
    expect(suite['name']).toBe('Auth Tests');
    expect(suite['run_id']).toBe(RUN_ID);

    // 3. test.start
    const testStartResult = await ingestionApi.events.send(
      createTestStartEvent({
        runId: RUN_ID,
        payload: { testId: TEST_ID, suiteId: SUITE_ID, testName: 'should login successfully' },
      }),
    );
    expect(testStartResult.status).toBe(202);

    const testRow = await waitForRow(() => sql`SELECT * FROM tests WHERE id = ${TEST_ID}`);
    expect(testRow['name']).toBe('should login successfully');
    expect(testRow['status']).toBe('pending');

    // 4. test.end
    const testEndResult = await ingestionApi.events.send(
      createTestEndEvent({
        runId: RUN_ID,
        payload: { testId: TEST_ID, status: 'passed', durationMs: 150 },
      }),
    );
    expect(testEndResult.status).toBe(202);

    const updatedTest = await waitForRow(() => sql`SELECT * FROM tests WHERE id = ${TEST_ID}`, {
      predicate: (row) => row['status'] === 'passed',
    });
    expect(updatedTest['status']).toBe('passed');
    expect(updatedTest['duration_ms']).toBe(150);

    // 5. suite.end (no-op for DB, but still should be accepted)
    const suiteEndResult = await ingestionApi.events.send(
      createSuiteEndEvent({ runId: RUN_ID, payload: { suiteId: SUITE_ID } }),
    );
    expect(suiteEndResult.status).toBe(202);

    // 6. run.end
    const runEndResult = await ingestionApi.events.send(
      createRunEndEvent({ runId: RUN_ID, payload: { status: 'passed' } }),
    );
    expect(runEndResult.status).toBe(202);

    const finishedRun = await waitForRow(() => sql`SELECT * FROM runs WHERE id = ${RUN_ID}`, {
      predicate: (row) => row['status'] === 'passed',
    });
    expect(finishedRun['status']).toBe('passed');
    expect(finishedRun['total_tests']).toBe(1);
    expect(finishedRun['passed_tests']).toBe(1);
  }, 60_000);

  it('skips duplicate events', async () => {
    const duplicateRunId = crypto.randomUUID();

    // Send the same event twice with the same runId
    const body1 = await ingestionApi.events.send(createRunStartEvent({ runId: duplicateRunId }));
    const body2 = await ingestionApi.events.send(createRunStartEvent({ runId: duplicateRunId }));

    // Both should be accepted by the ingestion API (publish-only)
    expect(body1.body).toHaveProperty('eventId');
    expect(body2.body).toHaveProperty('eventId');

    // Wait for the first event to be processed
    await waitForRow(() => sql`SELECT * FROM runs WHERE id = ${duplicateRunId}`);

    // Give extra time for potential duplicate processing
    await new Promise((r) => setTimeout(r, 2000));

    // Should only have one run row (deduplication prevents duplicate insert)
    const rows = await sql`SELECT * FROM runs WHERE id = ${duplicateRunId}`;
    expect(rows).toHaveLength(1);
  }, 30_000);
});
