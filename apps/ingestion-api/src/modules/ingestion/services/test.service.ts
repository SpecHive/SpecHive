import { tests } from '@assertly/database';
import type { Transaction } from '@assertly/database';
import type { TestEndEvent, TestStartEvent } from '@assertly/reporter-core-protocol';
import { TestStatus } from '@assertly/shared-types';
import type { OrganizationId, ProjectId, RunId } from '@assertly/shared-types';
import { Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { verifyRunOwnership } from './verify-run-ownership';

@Injectable()
export class TestService {
  private readonly logger = new Logger(TestService.name);

  async handleTestStart(
    event: TestStartEvent,
    projectId: ProjectId,
    organizationId: OrganizationId,
    tx: Transaction,
  ): Promise<{ runId: RunId }> {
    await verifyRunOwnership(event.runId, projectId, tx);

    await tx.insert(tests).values({
      id: event.payload.testId,
      suiteId: event.payload.suiteId,
      runId: event.runId,
      organizationId,
      name: event.payload.testName,
      status: TestStatus.Pending,
      startedAt: new Date(event.timestamp),
    });

    this.logger.log(`Created test ${event.payload.testId}`);
    return { runId: event.runId };
  }

  async handleTestEnd(
    event: TestEndEvent,
    projectId: ProjectId,
    tx: Transaction,
  ): Promise<{ runId: RunId }> {
    await verifyRunOwnership(event.runId, projectId, tx);

    await tx
      .update(tests)
      .set({
        status: event.payload.status,
        durationMs: event.payload.durationMs ?? null,
        errorMessage: event.payload.errorMessage ?? null,
        stackTrace: event.payload.stackTrace ?? null,
        retryCount: event.payload.retryCount ?? 0,
        finishedAt: new Date(event.timestamp),
      })
      .where(and(eq(tests.id, event.payload.testId), eq(tests.runId, event.runId)));

    this.logger.log(`Updated test ${event.payload.testId} status to ${event.payload.status}`);
    return { runId: event.runId };
  }
}
