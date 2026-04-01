import { Injectable } from '@nestjs/common';
import {
  computeFingerprint,
  dailyFlakyTestStats,
  errorGroups,
  errorOccurrences,
  runs,
  testAttempts,
  tests,
} from '@spechive/database';
import { InjectPinoLogger, PinoLogger } from '@spechive/nestjs-common';
import type { TestEndEvent } from '@spechive/reporter-core-protocol';
import { MAX_ERROR_MESSAGE_LENGTH, TestStatus, stripAnsi } from '@spechive/shared-types';
import { and, eq, sql } from 'drizzle-orm';

import { EventHandler } from './event-handler.decorator';
import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

@EventHandler()
@Injectable()
export class TestEndHandler implements IEventHandler<TestEndEvent> {
  readonly eventType = 'test.end' as const;

  constructor(@InjectPinoLogger(TestEndHandler.name) private readonly logger: PinoLogger) {}

  async handle(event: TestEndEvent, ctx: EventHandlerContext): Promise<void> {
    const {
      testId,
      status,
      durationMs,
      errorMessage,
      stackTrace,
      retryCount,
      attempts,
      errorName,
      errorCategory,
      errorExpected,
      errorActual,
      errorLocation,
    } = event.payload;

    const strippedErrorMessage = errorMessage ? stripAnsi(errorMessage) : null;
    const strippedStackTrace = stackTrace ? stripAnsi(stackTrace) : null;
    const strippedErrorName = errorName ? stripAnsi(errorName) : null;
    const strippedErrorCategory = errorCategory ?? null;
    const strippedErrorExpected = errorExpected ? stripAnsi(errorExpected) : null;
    const strippedErrorActual = errorActual ? stripAnsi(errorActual) : null;

    const [updatedTest] = await ctx.tx
      .update(tests)
      .set({
        status,
        durationMs: durationMs ?? null,
        errorMessage: strippedErrorMessage?.slice(0, MAX_ERROR_MESSAGE_LENGTH) ?? null,
        stackTrace: strippedStackTrace,
        errorName: strippedErrorName,
        errorCategory: strippedErrorCategory,
        errorExpected: strippedErrorExpected,
        errorActual: strippedErrorActual,
        errorLocation: errorLocation ?? null,
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
            errorName: a.errorName ?? null,
            errorCategory: a.errorCategory ?? null,
            errorExpected: a.errorExpected ? stripAnsi(a.errorExpected) : null,
            errorActual: a.errorActual ? stripAnsi(a.errorActual) : null,
            errorLocation: a.errorLocation ?? null,
            startedAt: a.startedAt ? new Date(a.startedAt) : null,
            finishedAt: a.finishedAt ? new Date(a.finishedAt) : null,
            // Deterministic createdAt for dedup with composite unique index (test_id, retry_index, created_at)
            createdAt: a.startedAt ? new Date(a.startedAt) : new Date(event.timestamp),
          })),
        )
        .onConflictDoNothing();
    }

    // --- Error fingerprinting & grouping ---
    if (
      updatedTest &&
      strippedErrorMessage &&
      (status === TestStatus.Failed || status === TestStatus.Flaky)
    ) {
      const strippedErrorMatcher = event.payload.errorMatcher
        ? stripAnsi(event.payload.errorMatcher)
        : undefined;
      const strippedErrorTarget = event.payload.errorTarget
        ? stripAnsi(event.payload.errorTarget)
        : undefined;

      const { fingerprint, normalizedMessage, title } = computeFingerprint(
        strippedErrorMessage,
        strippedErrorName ?? undefined,
        {
          errorCategory: strippedErrorCategory ?? undefined,
          errorMatcher: strippedErrorMatcher,
          errorTarget: strippedErrorTarget,
          errorExpected: strippedErrorExpected ?? undefined,
        },
      );

      const [runInfo] = await ctx.tx
        .select({ branch: runs.branch, commitSha: runs.commitSha })
        .from(runs)
        .where(eq(runs.id, event.runId))
        .limit(1);

      const eventTime = new Date(event.timestamp);

      const [group] = await ctx.tx
        .insert(errorGroups)
        .values({
          organizationId: ctx.organizationId,
          projectId: ctx.projectId,
          fingerprint,
          title,
          normalizedMessage,
          errorName: strippedErrorName,
          errorCategory: strippedErrorCategory,
          totalOccurrences: 1,
          uniqueTestCount: 1,
          uniqueBranchCount: runInfo?.branch ? 1 : 0,
          firstSeenAt: eventTime,
          lastSeenAt: eventTime,
        })
        // Only timestamps/name/category updated on conflict — aggregate columns are not maintained (reserved for future analytics).
        // COALESCE prefers incoming value: safe because errorName is part of the fingerprint hash,
        // so conflicting rows always share the same errorName (or both null).
        // errorCategory is not in the unstructured fingerprint path, but fallback categories are stable.
        .onConflictDoUpdate({
          target: [errorGroups.projectId, errorGroups.fingerprint],
          set: {
            lastSeenAt: sql`GREATEST(${errorGroups.lastSeenAt}, EXCLUDED.last_seen_at)`,
            errorName: sql`COALESCE(EXCLUDED.error_name, ${errorGroups.errorName})`,
            // Prefer structured categories (assertion/timeout/action) over the generic 'runtime' fallback.
            // This prevents a less-informed reporter from downgrading a previously well-categorized error.
            errorCategory: sql`CASE
              WHEN EXCLUDED.error_category IN ('assertion', 'timeout', 'action') THEN EXCLUDED.error_category
              ELSE COALESCE(${errorGroups.errorCategory}, EXCLUDED.error_category)
            END`,
            updatedAt: sql`NOW()`,
          },
        })
        .returning({ id: errorGroups.id });

      if (group) {
        await ctx.tx
          .insert(errorOccurrences)
          .values({
            organizationId: ctx.organizationId,
            errorGroupId: group.id,
            testId,
            runId: event.runId,
            projectId: ctx.projectId,
            branch: runInfo?.branch ?? null,
            commitSha: runInfo?.commitSha ?? null,
            testName: updatedTest.name,
            errorMessage: strippedErrorMessage.slice(0, MAX_ERROR_MESSAGE_LENGTH),
            occurredAt: eventTime,
          })
          .onConflictDoNothing({ target: [errorOccurrences.runId, errorOccurrences.testId] });

        // Aggregate counters are authoritatively recounted by RunEndHandler.
        // No per-test recount — avoids concurrency races and full-table scans.

        await ctx.tx
          .update(tests)
          .set({ errorGroupId: group.id })
          .where(and(eq(tests.id, testId), eq(tests.runId, event.runId)));
      } else {
        throw new Error(
          `Failed to upsert error group for fingerprint ${fingerprint} in run ${event.runId}`,
        );
      }
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

    this.logger.info({ testId, status, runId: event.runId }, 'Test ended');
  }
}
