import { Injectable, Logger } from '@nestjs/common';
import type { SuiteEndEvent } from '@spechive/reporter-core-protocol';

import { EventHandler } from './event-handler.decorator';
import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

@EventHandler()
@Injectable()
export class SuiteEndHandler implements IEventHandler<SuiteEndEvent> {
  readonly eventType = 'suite.end' as const;
  private readonly logger = new Logger(SuiteEndHandler.name);

  // Suites table has no status or finishedAt — nothing to persist
  async handle(event: SuiteEndEvent, _ctx: EventHandlerContext): Promise<void> {
    this.logger.log(`Suite ${event.payload.suiteId} ended in run ${event.runId}`);
  }
}
