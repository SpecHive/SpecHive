import { runs, tests } from '@assertly/database';
import type { Database } from '@assertly/database';
import type { TestEndEvent, TestStartEvent } from '@assertly/reporter-core-protocol';
import { TestStatus } from '@assertly/shared-types';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

@Injectable()
export class TestService {
  private readonly logger = new Logger(TestService.name);

  async handleTestStart(
    event: TestStartEvent,
    projectId: string,
    tx: Database,
  ): Promise<{ runId: string }> {
    const [run] = await tx
      .select({ projectId: runs.projectId })
      .from(runs)
      .where(eq(runs.id, event.runId))
      .limit(1);

    if (!run || run.projectId !== projectId) {
      throw new NotFoundException(`Run ${event.runId} not found in project`);
    }

    await tx.insert(tests).values({
      id: event.payload.testId,
      suiteId: event.payload.suiteId,
      runId: event.runId,
      name: event.payload.testName,
      status: TestStatus.Pending,
      startedAt: new Date(event.timestamp),
    });

    this.logger.log(`Created test ${event.payload.testId}`);
    return { runId: event.runId };
  }

  async handleTestEnd(
    event: TestEndEvent,
    projectId: string,
    tx: Database,
  ): Promise<{ runId: string }> {
    const [run] = await tx
      .select({ projectId: runs.projectId })
      .from(runs)
      .where(eq(runs.id, event.runId))
      .limit(1);

    if (!run || run.projectId !== projectId) {
      throw new NotFoundException(`Run ${event.runId} not found in project`);
    }

    await tx
      .update(tests)
      .set({
        status: event.payload.status,
        durationMs: event.payload.durationMs ?? null,
        errorMessage: event.payload.errorMessage ?? null,
        stackTrace: event.payload.stackTrace ?? null,
        retryCount: event.payload.retryCount ?? 0,
        finishedAt: new Date(event.timestamp),
        updatedAt: new Date(),
      })
      .where(eq(tests.id, event.payload.testId));

    this.logger.log(`Updated test ${event.payload.testId} status to ${event.payload.status}`);
    return { runId: event.runId };
  }
}
