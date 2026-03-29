import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { IngestionApiClient, QueryApiClient } from '../helpers/api-clients';
import {
  GATEWAY_URL,
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

const ingestionApi = new IngestionApiClient(GATEWAY_URL, PROJECT_TOKEN);
const queryApi = new QueryApiClient(GATEWAY_URL);

const RUN_ID = crypto.randomUUID();
const SUITE_ID = crypto.randomUUID();
const FLAKY_TEST_ID = crypto.randomUUID();
const PASSED_TEST_ID = crypto.randomUUID();

describe('Flaky tests counter', () => {
  let sql: Awaited<ReturnType<typeof createPostgresConnection>>;
  let jwt: string;

  beforeAll(async () => {
    sql = await createPostgresConnection(buildSuperuserDatabaseUrl());

    await waitForService(GATEWAY_URL);
    jwt = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD);
  }, 30_000);

  afterAll(async () => {
    await sql.end();
  });

  it('increments flakyTests counter on test.end with status flaky', async () => {
    await ingestionApi.events.send(createRunStartEvent({ runId: RUN_ID }));
    await waitForRow(() => sql`SELECT * FROM runs WHERE id = ${RUN_ID}`);

    await ingestionApi.events.send(
      createSuiteStartEvent({
        runId: RUN_ID,
        payload: { suiteId: SUITE_ID, suiteName: 'Flaky Test Suite' },
      }),
    );
    await waitForRow(() => sql`SELECT * FROM suites WHERE id = ${SUITE_ID}`);

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

    await ingestionApi.events.send(
      createRunEndEvent({ runId: RUN_ID, payload: { status: 'passed' } }),
    );

    const finishedRun = await waitForRow(() => sql`SELECT * FROM runs WHERE id = ${RUN_ID}`, {
      predicate: (row) => row['status'] === 'passed',
    });
    expect(finishedRun['total_tests']).toBe(2);
    expect(finishedRun['passed_tests']).toBe(1);
    expect(finishedRun['flaky_tests']).toBe(1);

    const { status: listStatus, body: listBody } = await queryApi.runs.list(jwt, SEED_PROJECT_ID);
    expect(listStatus).toBe(200);
    const matchingRun = listBody.data.find((r) => r['id'] === RUN_ID);
    expect(matchingRun).toBeDefined();
    expect(matchingRun).toHaveProperty('flakyTests');
    expect(typeof matchingRun!['flakyTests']).toBe('number');

    const { status: detailStatus, body: detailBody } = await queryApi.runs.get(jwt, RUN_ID);
    expect(detailStatus).toBe(200);
    expect(detailBody['flakyTests']).toBe(1);
  }, 60_000);
});
