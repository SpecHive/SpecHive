import { runs, tests } from '@assertly/database';
import type { TestEndEvent } from '@assertly/reporter-core-protocol';
import { TestStatus } from '@assertly/shared-types';
import { Injectable, Logger } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

@Injectable()
export class TestEndHandler implements IEventHandler<TestEndEvent> {
  readonly eventType = 'test.end' as const;
  private readonly logger = new Logger(TestEndHandler.name);

  async handle(event: TestEndEvent, ctx: EventHandlerContext): Promise<void> {
    const { testId, status, durationMs, errorMessage, stackTrace, retryCount } = event.payload;

    await ctx.tx
      .update(tests)
      .set({
        status,
        durationMs: durationMs ?? null,
        errorMessage: errorMessage ?? null,
        stackTrace: stackTrace ?? null,
        retryCount: retryCount ?? 0,
        finishedAt: new Date(event.timestamp),
      })
      .where(and(eq(tests.id, testId), eq(tests.runId, event.runId)));

    const counterField =
      status === TestStatus.Passed
        ? runs.passedTests
        : status === TestStatus.Failed
          ? runs.failedTests
          : status === TestStatus.Skipped
            ? runs.skippedTests
            : null;

    await ctx.tx
      .update(runs)
      .set({
        totalTests: sql`${runs.totalTests} + 1`,
        ...(counterField ? { [counterField.name]: sql`${counterField} + 1` } : {}),
      })
      .where(eq(runs.id, event.runId));

    this.logger.log(`Test ${testId} ended with status ${status} in run ${event.runId}`);
  }
}
