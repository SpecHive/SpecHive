import { Injectable, Logger } from '@nestjs/common';
import { runs } from '@spechive/database';
import type { RunStartEvent } from '@spechive/reporter-core-protocol';
import { RunStatus } from '@spechive/shared-types';

import { EventHandler } from './event-handler.decorator';
import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

@EventHandler()
@Injectable()
export class RunStartHandler implements IEventHandler<RunStartEvent> {
  readonly eventType = 'run.start' as const;
  private readonly logger = new Logger(RunStartHandler.name);

  async handle(event: RunStartEvent, ctx: EventHandlerContext): Promise<void> {
    const ci = event.payload.ci;

    const result = await ctx.tx
      .insert(runs)
      .values({
        id: event.runId,
        projectId: ctx.projectId,
        organizationId: ctx.organizationId,
        name: event.payload.runName ?? null,
        status: RunStatus.Pending,
        startedAt: new Date(event.timestamp),
        metadata: (event.payload.metadata ?? {}) as Record<string, unknown>,
        branch: ci?.branch ?? null,
        commitSha: ci?.commitSha ?? null,
        ciProvider: ci?.ciProvider ?? null,
        ciUrl: ci?.ciUrl ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: runs.id });

    if (result.length === 0) {
      this.logger.debug(`Duplicate run.start skipped for run ${event.runId}`);
      return;
    }

    this.logger.log(`Created run ${event.runId}`);
  }
}
