import { suites } from '@assertly/database';
import type { SuiteStartEvent } from '@assertly/reporter-core-protocol';
import { Injectable, Logger } from '@nestjs/common';

import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

@Injectable()
export class SuiteStartHandler implements IEventHandler<SuiteStartEvent> {
  readonly eventType = 'suite.start' as const;
  private readonly logger = new Logger(SuiteStartHandler.name);

  async handle(event: SuiteStartEvent, ctx: EventHandlerContext): Promise<void> {
    await ctx.tx.insert(suites).values({
      id: event.payload.suiteId,
      runId: event.runId,
      organizationId: ctx.organizationId,
      name: event.payload.suiteName,
      parentSuiteId: event.payload.parentSuiteId ?? null,
    });

    this.logger.log(`Created suite ${event.payload.suiteId} in run ${event.runId}`);
  }
}
