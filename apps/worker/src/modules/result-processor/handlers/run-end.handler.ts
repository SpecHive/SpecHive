import { Injectable, Logger } from '@nestjs/common';
import { runs } from '@spechive/database';
import type { RunEndEvent } from '@spechive/reporter-core-protocol';
import { RunStatus } from '@spechive/shared-types';
import { eq } from 'drizzle-orm';

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
    const [current] = await ctx.tx
      .select({ status: runs.status })
      .from(runs)
      .where(eq(runs.id, event.runId));

    if (!current) {
      this.logger.warn(`Run ${event.runId} not found, skipping status update`);
      return;
    }

    const allowedTargets = VALID_TRANSITIONS[current.status];

    if (!allowedTargets) {
      this.logger.warn(`Run ${event.runId} already in terminal state '${current.status}'`);
      return;
    }

    if (!allowedTargets.includes(event.payload.status as RunStatus)) {
      this.logger.warn(
        `Invalid transition from '${current.status}' to '${event.payload.status}' for run ${event.runId}`,
      );
      return;
    }

    await ctx.tx
      .update(runs)
      .set({
        status: event.payload.status,
        finishedAt: new Date(event.timestamp),
      })
      .where(eq(runs.id, event.runId));

    this.logger.log(`Finished run ${event.runId} with status ${event.payload.status}`);
  }
}
