import { Injectable } from '@nestjs/common';
import { dailyRunStats, runs, tests } from '@spechive/database';
import { InjectPinoLogger, PinoLogger } from '@spechive/nestjs-common';
import type { RunEndEvent } from '@spechive/reporter-core-protocol';
import { RunStatus } from '@spechive/shared-types';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { EventHandler } from './event-handler.decorator';
import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

const VALID_TRANSITIONS: Record<string, RunStatus[]> = {
  [RunStatus.Pending]: [RunStatus.Running, RunStatus.Passed, RunStatus.Failed, RunStatus.Cancelled],
  [RunStatus.Running]: [RunStatus.Passed, RunStatus.Failed, RunStatus.Cancelled],
};

@EventHandler()
@Injectable()
export class RunEndHandler implements IEventHandler<RunEndEvent> {
  readonly eventType = 'run.end' as const;

  constructor(@InjectPinoLogger(RunEndHandler.name) private readonly logger: PinoLogger) {}

  async handle(event: RunEndEvent, ctx: EventHandlerContext): Promise<void> {
    const targetStatus = event.payload.status as RunStatus;
    const validSources = Object.entries(VALID_TRANSITIONS)
      .filter(([, targets]) => targets.includes(targetStatus))
      .map(([source]) => source);

    if (validSources.length === 0) {
      this.logger.warn({ targetStatus }, 'Invalid target status for run.end event');
      return;
    }

    const finishedAt = new Date(event.timestamp);

    const result = await ctx.tx
      .update(runs)
      .set({
        status: event.payload.status,
        finishedAt,
      })
      .where(and(eq(runs.id, event.runId), inArray(runs.status, validSources)))
      .returning({
        id: runs.id,
        totalTests: runs.totalTests,
        passedTests: runs.passedTests,
        failedTests: runs.failedTests,
        skippedTests: runs.skippedTests,
        flakyTests: runs.flakyTests,
        startedAt: runs.startedAt,
      });

    if (result.length === 0) {
      this.logger.warn(
        { runId: event.runId },
        'Run not found or already in terminal state, skipping',
      );
      return;
    }

    const run = result[0];
    // null when startedAt is absent — this run is excluded from duration aggregates
    const durationMs = run.startedAt ? finishedAt.getTime() - run.startedAt.getTime() : null;

    const [retriedRow] = await ctx.tx.execute(sql`
      SELECT COUNT(*)::int AS "retriedTests"
      FROM ${tests}
      WHERE ${tests.runId} = ${event.runId} AND ${tests.retryCount} > 0
    `);
    const retriedTests = (retriedRow as { retriedTests: number }).retriedTests;

    await ctx.tx.execute(sql`
      INSERT INTO ${dailyRunStats} (
        project_id, organization_id, day,
        total_runs, total_tests, passed_tests, failed_tests, skipped_tests, flaky_tests,
        retried_tests, sum_duration_ms, min_duration_ms, max_duration_ms
      )
      VALUES (
        ${ctx.projectId}, ${ctx.organizationId},
        date_trunc('day', ${finishedAt.toISOString()}::timestamptz AT TIME ZONE 'UTC')::date,
        1, ${run.totalTests}, ${run.passedTests}, ${run.failedTests}, ${run.skippedTests}, ${run.flakyTests},
        ${retriedTests}, COALESCE(${durationMs}::bigint, 0), ${durationMs}, ${durationMs}
      )
      ON CONFLICT (project_id, day) DO UPDATE SET
        total_runs = ${dailyRunStats.totalRuns} + 1,
        total_tests = ${dailyRunStats.totalTests} + EXCLUDED.total_tests,
        passed_tests = ${dailyRunStats.passedTests} + EXCLUDED.passed_tests,
        failed_tests = ${dailyRunStats.failedTests} + EXCLUDED.failed_tests,
        skipped_tests = ${dailyRunStats.skippedTests} + EXCLUDED.skipped_tests,
        flaky_tests = ${dailyRunStats.flakyTests} + EXCLUDED.flaky_tests,
        retried_tests = ${dailyRunStats.retriedTests} + EXCLUDED.retried_tests,
        sum_duration_ms = CASE
          WHEN EXCLUDED.min_duration_ms IS NULL THEN ${dailyRunStats.sumDurationMs}
          ELSE ${dailyRunStats.sumDurationMs} + EXCLUDED.sum_duration_ms
        END,
        min_duration_ms = CASE
          WHEN EXCLUDED.min_duration_ms IS NULL THEN ${dailyRunStats.minDurationMs}
          ELSE COALESCE(LEAST(${dailyRunStats.minDurationMs}, EXCLUDED.min_duration_ms), EXCLUDED.min_duration_ms)
        END,
        max_duration_ms = CASE
          WHEN EXCLUDED.max_duration_ms IS NULL THEN ${dailyRunStats.maxDurationMs}
          ELSE COALESCE(GREATEST(${dailyRunStats.maxDurationMs}, EXCLUDED.max_duration_ms), EXCLUDED.max_duration_ms)
        END
    `);

    this.logger.info({ runId: event.runId, status: event.payload.status }, 'Run finished');
  }
}
