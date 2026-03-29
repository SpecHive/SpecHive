import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from '@spechive/nestjs-common';
import type { SuiteEndEvent } from '@spechive/reporter-core-protocol';

import { EventHandler } from './event-handler.decorator';
import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

@EventHandler()
@Injectable()
export class SuiteEndHandler implements IEventHandler<SuiteEndEvent> {
  readonly eventType = 'suite.end' as const;

  constructor(@InjectPinoLogger(SuiteEndHandler.name) private readonly logger: PinoLogger) {}

  // Suites table has no status or finishedAt — nothing to persist
  async handle(event: SuiteEndEvent, _ctx: EventHandlerContext): Promise<void> {
    this.logger.info({ suiteId: event.payload.suiteId, runId: event.runId }, 'Suite ended');
  }
}
