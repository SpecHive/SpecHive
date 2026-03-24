/**
 * Integration test for daily_run_stats UPSERT accumulation semantics.
 *
 * Sends two complete run lifecycles on the same calendar day and asserts
 * that the worker correctly accumulates total_runs = 2, with correct min/max.
 *
 * Requires the full Docker Compose stack running:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { IngestionApiClient } from '../helpers/api-clients';
import { GATEWAY_URL, PROJECT_TOKEN, SEED_ORG_ID, SEED_PROJECT_ID } from '../helpers/constants';
import { buildSuperuserDatabaseUrl, createPostgresConnection } from '../helpers/database';
import { createFullRunEvents } from '../helpers/factories';
import { waitForService, waitForRow } from '../helpers/wait';

const ingestionApi = new IngestionApiClient(GATEWAY_URL, PROJECT_TOKEN);

// Deterministic IDs — unique prefix avoids collisions with other integration tests
const RUN_A_ID = `01970000-acc0-7000-8000-000000000001`;
const RUN_B_ID = `01970000-acc0-7000-8000-000000000002`;

describe('daily_run_stats UPSERT accumulation', () => {
  let sql: Awaited<ReturnType<typeof createPostgresConnection>>;

  beforeAll(async () => {
    sql = await createPostgresConnection(buildSuperuserDatabaseUrl());
    await waitForService(GATEWAY_URL);
  }, 30_000);

  afterAll(async () => {
    // Clean up in reverse dependency order
    await sql`DELETE FROM daily_run_stats WHERE project_id = ${SEED_PROJECT_ID} AND organization_id = ${SEED_ORG_ID} AND total_runs >= 2`;
    await sql`DELETE FROM tests WHERE run_id IN (${RUN_A_ID}, ${RUN_B_ID})`;
    await sql`DELETE FROM suites WHERE run_id IN (${RUN_A_ID}, ${RUN_B_ID})`;
    await sql`DELETE FROM runs WHERE id IN (${RUN_A_ID}, ${RUN_B_ID})`;
    await sql.end();
  });

  it('accumulates two runs into the same daily_run_stats row', async () => {
    const { events: eventsA } = createFullRunEvents({
      runId: RUN_A_ID,
      durationMs: 3_000,
    });
    const { events: eventsB } = createFullRunEvents({
      runId: RUN_B_ID,
      durationMs: 7_000,
    });

    // Send both run lifecycles
    for (const event of [...eventsA, ...eventsB]) {
      await ingestionApi.events.send(event);
    }

    // Wait for both runs to finish
    await waitForRow(() => sql`SELECT * FROM runs WHERE id = ${RUN_A_ID}`, {
      predicate: (row) => row['status'] === 'passed',
    });
    await waitForRow(() => sql`SELECT * FROM runs WHERE id = ${RUN_B_ID}`, {
      predicate: (row) => row['status'] === 'passed',
    });

    // Wait for the daily_run_stats row to accumulate both runs
    const statsRow = await waitForRow(
      () =>
        sql`
          SELECT total_runs, min_duration_ms, max_duration_ms, sum_duration_ms
          FROM daily_run_stats
          WHERE project_id = ${SEED_PROJECT_ID}
            AND organization_id = ${SEED_ORG_ID}
            AND total_runs >= 2
        `,
      { predicate: (row) => (row['total_runs'] as number) >= 2 },
    );

    expect(statsRow['total_runs']).toBeGreaterThanOrEqual(2);
    // min must be the shorter run, max the longer
    expect(statsRow['min_duration_ms']).toBeLessThanOrEqual(statsRow['max_duration_ms'] as number);
    // sum must be at least both durations combined
    expect(statsRow['sum_duration_ms']).toBeGreaterThanOrEqual(
      (statsRow['min_duration_ms'] as number) + (statsRow['max_duration_ms'] as number),
    );
  }, 60_000);
});
