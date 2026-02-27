import { runs } from '@assertly/database';
import type { RunStartEvent } from '@assertly/reporter-core-protocol';
import { RunStatus } from '@assertly/shared-types';
import { Injectable, Logger } from '@nestjs/common';

import type { EventHandlerContext } from './event-handler.interface';

@Injectable()
export class RunStartHandler {
  private readonly logger = new Logger(RunStartHandler.name);

  async handle(event: RunStartEvent, ctx: EventHandlerContext): Promise<void> {
    await ctx.tx.insert(runs).values({
      id: event.runId,
      projectId: ctx.projectId,
      organizationId: ctx.organizationId,
      status: RunStatus.Pending,
      startedAt: new Date(event.timestamp),
      metadata: (event.payload.metadata ?? {}) as Record<string, unknown>,
    });

    this.logger.log(`Created run ${event.runId}`);
  }
}
