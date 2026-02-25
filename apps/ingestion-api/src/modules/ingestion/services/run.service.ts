import { runs } from '@assertly/database';
import type { Database } from '@assertly/database';
import type { RunEndEvent, RunStartEvent } from '@assertly/reporter-core-protocol';
import { RunStatus } from '@assertly/shared-types';
import type { ProjectId, RunId } from '@assertly/shared-types';
import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { verifyRunOwnership } from './verify-run-ownership';

@Injectable()
export class RunService {
  private readonly logger = new Logger(RunService.name);

  async handleRunStart(
    event: RunStartEvent,
    projectId: ProjectId,
    tx: Database,
  ): Promise<{ runId: RunId }> {
    await tx.insert(runs).values({
      id: event.runId,
      projectId,
      status: RunStatus.Pending,
      startedAt: new Date(event.timestamp),
      metadata: (event.payload.metadata ?? {}) as Record<string, unknown>,
    });

    this.logger.log(`Created run ${event.runId}`);
    return { runId: event.runId };
  }

  async handleRunEnd(
    event: RunEndEvent,
    projectId: ProjectId,
    tx: Database,
  ): Promise<{ runId: RunId }> {
    await verifyRunOwnership(event.runId, projectId, tx);

    await tx
      .update(runs)
      .set({
        status: event.payload.status,
        finishedAt: new Date(event.timestamp),
        updatedAt: new Date(),
      })
      .where(eq(runs.id, event.runId));

    this.logger.log(`Updated run ${event.runId} status to ${event.payload.status}`);
    return { runId: event.runId };
  }
}
