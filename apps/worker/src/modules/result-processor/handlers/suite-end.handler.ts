import type { SuiteEndEvent } from '@assertly/reporter-core-protocol';
import { Injectable, Logger } from '@nestjs/common';

import type { EventHandlerContext } from './event-handler.interface';

@Injectable()
export class SuiteEndHandler {
  private readonly logger = new Logger(SuiteEndHandler.name);

  // Suites table has no status or finishedAt — nothing to persist
  async handle(event: SuiteEndEvent, _ctx: EventHandlerContext): Promise<void> {
    this.logger.log(`Suite ${event.payload.suiteId} ended in run ${event.runId}`);
  }
}
