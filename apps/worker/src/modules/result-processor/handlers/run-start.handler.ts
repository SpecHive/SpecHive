import { runs } from '@assertly/database';
import type { RunStartEvent } from '@assertly/reporter-core-protocol';
import { RunStatus } from '@assertly/shared-types';
import { Injectable, Logger } from '@nestjs/common';

import { EventHandler } from './event-handler.decorator';
import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

@EventHandler()
@Injectable()
export class RunStartHandler implements IEventHandler<RunStartEvent> {
  readonly eventType = 'run.start' as const;
  private readonly logger = new Logger(RunStartHandler.name);

  async handle(event: RunStartEvent, ctx: EventHandlerContext): Promise<void> {
    await ctx.tx
      .insert(runs)
      .values({
        id: event.runId,
        projectId: ctx.projectId,
        organizationId: ctx.organizationId,
        name: event.payload.runName ?? null,
        status: RunStatus.Pending,
        startedAt: new Date(event.timestamp),
        metadata: (event.payload.metadata ?? {}) as Record<string, unknown>,
      })
      .onConflictDoNothing({ target: runs.id });

    this.logger.log(`Created run ${event.runId}`);
  }
}
