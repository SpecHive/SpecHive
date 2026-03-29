import { Injectable } from '@nestjs/common';
import { suites } from '@spechive/database';
import { InjectPinoLogger, PinoLogger } from '@spechive/nestjs-common';
import type { SuiteStartEvent } from '@spechive/reporter-core-protocol';

import { EventHandler } from './event-handler.decorator';
import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

@EventHandler()
@Injectable()
export class SuiteStartHandler implements IEventHandler<SuiteStartEvent> {
  readonly eventType = 'suite.start' as const;

  constructor(@InjectPinoLogger(SuiteStartHandler.name) private readonly logger: PinoLogger) {}

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
      this.logger.debug({ suiteId: event.payload.suiteId }, 'Duplicate suite.start skipped');
      return;
    }

    this.logger.info({ suiteId: event.payload.suiteId, runId: event.runId }, 'Suite created');
  }
}
