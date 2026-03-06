import { suites } from '@assertly/database';
import type { SuiteStartEvent } from '@assertly/reporter-core-protocol';
import { Injectable, Logger } from '@nestjs/common';

import { EventHandler } from './event-handler.decorator';
import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

@EventHandler()
@Injectable()
export class SuiteStartHandler implements IEventHandler<SuiteStartEvent> {
  readonly eventType = 'suite.start' as const;
  private readonly logger = new Logger(SuiteStartHandler.name);

  async handle(event: SuiteStartEvent, ctx: EventHandlerContext): Promise<void> {
    const result = await ctx.tx
      .insert(suites)
      .values({
        id: event.payload.suiteId,
        runId: event.runId,
        organizationId: ctx.organizationId,
        name: event.payload.suiteName,
        parentSuiteId: event.payload.parentSuiteId ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: suites.id });

    if (result.length === 0) {
      this.logger.debug(`Duplicate suite.start skipped for suite ${event.payload.suiteId}`);
      return;
    }

    this.logger.log(`Created suite ${event.payload.suiteId} in run ${event.runId}`);
  }
}
