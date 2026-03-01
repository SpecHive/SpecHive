import { runs } from '@assertly/database';
import type { RunEndEvent } from '@assertly/reporter-core-protocol';
import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

@Injectable()
export class RunEndHandler implements IEventHandler<RunEndEvent> {
  readonly eventType = 'run.end' as const;
  private readonly logger = new Logger(RunEndHandler.name);

  async handle(event: RunEndEvent, ctx: EventHandlerContext): Promise<void> {
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
