import { Injectable } from '@nestjs/common';
import { runs } from '@spechive/database';
import { InjectPinoLogger, PinoLogger } from '@spechive/nestjs-common';
import type { RunStartEvent } from '@spechive/reporter-core-protocol';
import { RunStatus } from '@spechive/shared-types';

import { EventHandler } from './event-handler.decorator';
import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

@EventHandler()
@Injectable()
export class RunStartHandler implements IEventHandler<RunStartEvent> {
  readonly eventType = 'run.start' as const;

  constructor(@InjectPinoLogger(RunStartHandler.name) private readonly logger: PinoLogger) {}

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
        expectedTests: event.payload.expectedTests ?? 0,
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
      this.logger.debug({ runId: event.runId }, 'Duplicate run.start skipped');
      return;
    }

    this.logger.info({ runId: event.runId }, 'Run created');
  }
}
