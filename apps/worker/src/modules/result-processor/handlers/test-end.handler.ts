import { Injectable, Logger } from '@nestjs/common';
import { dailyFlakyTestStats, runs, tests, testAttempts } from '@spechive/database';
import type { TestEndEvent } from '@spechive/reporter-core-protocol';
import { TestStatus, stripAnsi } from '@spechive/shared-types';
import { and, eq, sql } from 'drizzle-orm';

import { EventHandler } from './event-handler.decorator';
import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

@EventHandler()
@Injectable()
export class TestEndHandler implements IEventHandler<TestEndEvent> {
  readonly eventType = 'test.end' as const;
  private readonly logger = new Logger(TestEndHandler.name);

  async handle(event: TestEndEvent, ctx: EventHandlerContext): Promise<void> {
    const { testId, status, durationMs, errorMessage, stackTrace, retryCount, attempts } =
      event.payload;

    const [updatedTest] = await ctx.tx
      .update(tests)
      .set({
        status,
        durationMs: durationMs ?? null,
        errorMessage: errorMessage ? stripAnsi(errorMessage) : null,
        stackTrace: stackTrace ? stripAnsi(stackTrace) : null,
        retryCount: retryCount ?? 0,
        finishedAt: new Date(event.timestamp),
      })
      .where(and(eq(tests.id, testId), eq(tests.runId, event.runId)))
      .returning({ name: tests.name });

    if (attempts?.length) {
      await ctx.tx
        .insert(testAttempts)
        .values(
          attempts.map((a) => ({
            testId,
            runId: event.runId,
            organizationId: ctx.organizationId,
            retryIndex: a.retryIndex,
            status: a.status,
            durationMs: a.durationMs ?? null,
            errorMessage: a.errorMessage ? stripAnsi(a.errorMessage) : null,
            stackTrace: a.stackTrace ? stripAnsi(a.stackTrace) : null,
            startedAt: a.startedAt ? new Date(a.startedAt) : null,
            finishedAt: a.finishedAt ? new Date(a.finishedAt) : null,
            // Deterministic createdAt for dedup with composite unique index (test_id, retry_index, created_at)
            createdAt: a.startedAt ? new Date(a.startedAt) : new Date(event.timestamp),
          })),
        )
        .onConflictDoNothing();
    }

    const counterUpdates =
      status === TestStatus.Passed
        ? { passedTests: sql`${runs.passedTests} + 1` }
        : status === TestStatus.Failed
          ? { failedTests: sql`${runs.failedTests} + 1` }
          : status === TestStatus.Skipped
            ? { skippedTests: sql`${runs.skippedTests} + 1` }
            : status === TestStatus.Flaky
              ? { flakyTests: sql`${runs.flakyTests} + 1` }
              : {};

    await ctx.tx
      .update(runs)
      .set({
        totalTests: sql`${runs.totalTests} + 1`,
        ...counterUpdates,
      })
      .where(eq(runs.id, event.runId));

    if (updatedTest) {
      const isFlaky = status === TestStatus.Flaky;
      const testDay = new Date(event.timestamp).toISOString();
      await ctx.tx.execute(sql`
        INSERT INTO ${dailyFlakyTestStats} (
          project_id, organization_id, test_name, day,
          flaky_count, total_count, total_retries
        )
        VALUES (
          ${ctx.projectId}, ${ctx.organizationId}, ${updatedTest.name},
          date_trunc('day', ${testDay}::timestamptz AT TIME ZONE 'UTC')::date,
          ${isFlaky ? 1 : 0}, 1, ${isFlaky ? (retryCount ?? 0) : 0}
        )
        ON CONFLICT (project_id, test_name, day) DO UPDATE SET
          flaky_count = ${dailyFlakyTestStats.flakyCount} + EXCLUDED.flaky_count,
          total_count = ${dailyFlakyTestStats.totalCount} + EXCLUDED.total_count,
          total_retries = ${dailyFlakyTestStats.totalRetries} + EXCLUDED.total_retries
      `);
    }

    this.logger.log(`Test ${testId} ended with status ${status} in run ${event.runId}`);
  }
}
