/// <reference types="node" />
/* eslint-disable no-console */
import 'dotenv/config';

import postgres from 'postgres';

async function backfill(): Promise<void> {
  const url = process.env['SEED_DATABASE_URL'];
  if (!url) {
    console.error(
      'SEED_DATABASE_URL is required. This script must run as the superuser role to bypass RLS.',
    );
    process.exit(1);
  }

  const db = postgres(url, { max: 1 });

  console.log('Starting backfill in a single transaction...');
  // TransactionSql<{}> extends Omit<Sql, ...> which strips call signatures in postgres.js v3 types.
  // Cast to the outer connection type so tagged template literals compile correctly.
  await db.begin(async (txSql) => {
    const sql = txSql as unknown as typeof db;
    console.log('Backfilling daily_run_stats from runs table...');
    const runStatsResult = await sql`
      INSERT INTO daily_run_stats (
        project_id, organization_id, day,
        total_runs, total_tests, passed_tests, failed_tests, skipped_tests, flaky_tests,
        retried_tests, sum_duration_ms, min_duration_ms, max_duration_ms
      )
      SELECT
        r.project_id,
        r.organization_id,
        date_trunc('day', r.finished_at AT TIME ZONE 'UTC')::date AS day,
        COUNT(*)::int AS total_runs,
        COALESCE(SUM(r.total_tests), 0)::int AS total_tests,
        COALESCE(SUM(r.passed_tests), 0)::int AS passed_tests,
        COALESCE(SUM(r.failed_tests), 0)::int AS failed_tests,
        COALESCE(SUM(r.skipped_tests), 0)::int AS skipped_tests,
        COALESCE(SUM(r.flaky_tests), 0)::int AS flaky_tests,
        COALESCE(SUM(t_retried.retried_count), 0)::int AS retried_tests,
        COALESCE(SUM(EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) * 1000), 0)::bigint AS sum_duration_ms,
        MIN(EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) * 1000)::int AS min_duration_ms,
        MAX(EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) * 1000)::int AS max_duration_ms
      FROM runs r
      LEFT JOIN (
        SELECT run_id, COUNT(*)::int AS retried_count
        FROM tests
        WHERE retry_count > 0
        GROUP BY run_id
      ) t_retried ON t_retried.run_id = r.id
      WHERE r.finished_at IS NOT NULL AND r.started_at IS NOT NULL
      GROUP BY r.project_id, r.organization_id, date_trunc('day', r.finished_at AT TIME ZONE 'UTC')::date
      ON CONFLICT (project_id, day) DO NOTHING
    `;
    console.log(`  daily_run_stats: ${runStatsResult.count} rows inserted`);

    console.log('Backfilling daily_flaky_test_stats from tests + runs tables...');
    const flakyStatsResult = await sql`
      INSERT INTO daily_flaky_test_stats (
        project_id, organization_id, test_name, day,
        flaky_count, total_count, total_retries
      )
      SELECT
        r.project_id,
        r.organization_id,
        t.name AS test_name,
        date_trunc('day', r.finished_at AT TIME ZONE 'UTC')::date AS day,
        COUNT(*) FILTER (WHERE t.status = 'flaky')::int AS flaky_count,
        COUNT(*)::int AS total_count,
        COALESCE(SUM(t.retry_count) FILTER (WHERE t.status = 'flaky'), 0)::int AS total_retries
      FROM tests t
        INNER JOIN runs r ON r.id = t.run_id
      WHERE r.finished_at IS NOT NULL
      GROUP BY r.project_id, r.organization_id, t.name, date_trunc('day', r.finished_at AT TIME ZONE 'UTC')::date
      ON CONFLICT (project_id, test_name, day) DO NOTHING
    `;
    console.log(`  daily_flaky_test_stats: ${flakyStatsResult.count} rows inserted`);
  });

  await db.end();
  console.log('Backfill completed successfully.');
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
