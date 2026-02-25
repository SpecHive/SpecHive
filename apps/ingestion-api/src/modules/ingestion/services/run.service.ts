import { runs } from '@assertly/database';
import type { Database } from '@assertly/database';
import type { RunEndEvent, RunStartEvent } from '@assertly/reporter-core-protocol';
import { RunStatus } from '@assertly/shared-types';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

@Injectable()
export class RunService {
  private readonly logger = new Logger(RunService.name);

  async handleRunStart(
    event: RunStartEvent,
    projectId: string,
    tx: Database,
  ): Promise<{ runId: string }> {
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
