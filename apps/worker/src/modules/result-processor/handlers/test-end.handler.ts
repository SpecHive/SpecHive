import { runs, tests, testAttempts } from '@assertly/database';
import type { TestEndEvent } from '@assertly/reporter-core-protocol';
import { TestStatus, stripAnsi } from '@assertly/shared-types';
import { Injectable, Logger } from '@nestjs/common';
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

    await ctx.tx
      .update(tests)
      .set({
        status,
        durationMs: durationMs ?? null,
        errorMessage: errorMessage ? stripAnsi(errorMessage) : null,
        stackTrace: stackTrace ? stripAnsi(stackTrace) : null,
        retryCount: retryCount ?? 0,
        finishedAt: new Date(event.timestamp),
      })
      .where(and(eq(tests.id, testId), eq(tests.runId, event.runId)));

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

    this.logger.log(`Test ${testId} ended with status ${status} in run ${event.runId}`);
  }
}
