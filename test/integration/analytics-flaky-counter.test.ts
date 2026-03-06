/**
 * Integration test for the flakyTests counter.
 *
 * Sends a test.end event with status 'flaky' through the ingestion pipeline
 * and verifies the run's flakyTests counter increments correctly.
 *
 * Requires the full Docker Compose stack running:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { IngestionApiClient, QueryApiClient } from '../helpers/api-clients';
import {
  INGESTION_URL,
  QUERY_API_URL,
  PROJECT_TOKEN,
  SEED_PROJECT_ID,
  SEED_EMAIL,
  SEED_PASSWORD,
} from '../helpers/constants';
import { buildSuperuserDatabaseUrl, createPostgresConnection } from '../helpers/database';
import {
  createRunStartEvent,
  createRunEndEvent,
  createSuiteStartEvent,
  createTestStartEvent,
  createTestEndEvent,
} from '../helpers/factories';
import { waitForService, waitForRow } from '../helpers/wait';

const ingestionApi = new IngestionApiClient(INGESTION_URL, PROJECT_TOKEN);
const queryApi = new QueryApiClient(QUERY_API_URL);

const RUN_ID = crypto.randomUUID();
const SUITE_ID = crypto.randomUUID();
const FLAKY_TEST_ID = crypto.randomUUID();
const PASSED_TEST_ID = crypto.randomUUID();

describe('Flaky tests counter', () => {
  let sql: Awaited<ReturnType<typeof createPostgresConnection>>;
  let jwt: string;

  beforeAll(async () => {
    sql = await createPostgresConnection(buildSuperuserDatabaseUrl());

    await waitForService(INGESTION_URL);
    await waitForService(QUERY_API_URL);
    jwt = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD);
  }, 30_000);

  afterAll(async () => {
    await sql.end();
  });

  it('increments flakyTests counter on test.end with status flaky', async () => {
    // 1. Start run
    await ingestionApi.events.send(createRunStartEvent({ runId: RUN_ID }));
    await waitForRow(() => sql`SELECT * FROM runs WHERE id = ${RUN_ID}`);

    // 2. Start suite
    await ingestionApi.events.send(
      createSuiteStartEvent({
        runId: RUN_ID,
        payload: { suiteId: SUITE_ID, suiteName: 'Flaky Test Suite' },
      }),
    );
    await waitForRow(() => sql`SELECT * FROM suites WHERE id = ${SUITE_ID}`);

    // 3. Start and end a flaky test
    await ingestionApi.events.send(
      createTestStartEvent({
        runId: RUN_ID,
        payload: {
          testId: FLAKY_TEST_ID,
          suiteId: SUITE_ID,
          testName: 'should handle intermittent failure',
        },
      }),
    );
    await waitForRow(() => sql`SELECT * FROM tests WHERE id = ${FLAKY_TEST_ID}`);

    await ingestionApi.events.send(
      createTestEndEvent({
        runId: RUN_ID,
        payload: { testId: FLAKY_TEST_ID, status: 'flaky', durationMs: 200 },
      }),
    );

    // 4. Start and end a passing test
    await ingestionApi.events.send(
      createTestStartEvent({
        runId: RUN_ID,
        payload: { testId: PASSED_TEST_ID, suiteId: SUITE_ID, testName: 'should pass reliably' },
      }),
    );
    await waitForRow(() => sql`SELECT * FROM tests WHERE id = ${PASSED_TEST_ID}`);

    await ingestionApi.events.send(
      createTestEndEvent({
        runId: RUN_ID,
        payload: { testId: PASSED_TEST_ID, status: 'passed', durationMs: 50 },
      }),
    );

    // 5. End run
    await ingestionApi.events.send(
      createRunEndEvent({ runId: RUN_ID, payload: { status: 'passed' } }),
    );

    // Wait for run counters to update
    const finishedRun = await waitForRow(() => sql`SELECT * FROM runs WHERE id = ${RUN_ID}`, {
      predicate: (row) => row['status'] === 'passed',
    });
    expect(finishedRun['total_tests']).toBe(2);
    expect(finishedRun['passed_tests']).toBe(1);
    expect(finishedRun['flaky_tests']).toBe(1);

    // 6. Verify the query API exposes flakyTests
    const { status: listStatus, body: listBody } = await queryApi.runs.list(jwt, SEED_PROJECT_ID);
    expect(listStatus).toBe(200);
    const matchingRun = listBody.data.find((r) => r['id'] === RUN_ID);
    expect(matchingRun).toBeDefined();
    expect(matchingRun).toHaveProperty('flakyTests');
    expect(typeof matchingRun!['flakyTests']).toBe('number');

    // 7. Verify run detail also includes flakyTests
    const { status: detailStatus, body: detailBody } = await queryApi.runs.get(jwt, RUN_ID);
    expect(detailStatus).toBe(200);
    expect(detailBody['flakyTests']).toBe(1);
  }, 60_000);
});
