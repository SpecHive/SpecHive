import { Injectable, Logger } from '@nestjs/common';
import { runs } from '@spechive/database';
import type { RunEndEvent } from '@spechive/reporter-core-protocol';
import { RunStatus } from '@spechive/shared-types';
import { and, eq, inArray } from 'drizzle-orm';

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
  private readonly logger = new Logger(RunEndHandler.name);

  async handle(event: RunEndEvent, ctx: EventHandlerContext): Promise<void> {
    const targetStatus = event.payload.status as RunStatus;
    const validSources = Object.entries(VALID_TRANSITIONS)
      .filter(([, targets]) => targets.includes(targetStatus))
      .map(([source]) => source);

    if (validSources.length === 0) {
      this.logger.warn(`Invalid target status '${targetStatus}' for run.end event`);
      return;
    }

    const result = await ctx.tx
      .update(runs)
      .set({
        status: event.payload.status,
        finishedAt: new Date(event.timestamp),
      })
      .where(and(eq(runs.id, event.runId), inArray(runs.status, validSources)))
      .returning({ id: runs.id });

    if (result.length === 0) {
      this.logger.warn(`Run ${event.runId} not found or already in terminal state, skipping`);
      return;
    }

    this.logger.log(`Finished run ${event.runId} with status ${event.payload.status}`);
  }
}
