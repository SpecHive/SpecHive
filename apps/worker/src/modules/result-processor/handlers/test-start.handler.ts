import { tests } from '@assertly/database';
import type { TestStartEvent } from '@assertly/reporter-core-protocol';
import { TestStatus } from '@assertly/shared-types';
import { Injectable, Logger } from '@nestjs/common';

import type { EventHandlerContext } from './event-handler.interface';

@Injectable()
export class TestStartHandler {
  private readonly logger = new Logger(TestStartHandler.name);

  async handle(event: TestStartEvent, ctx: EventHandlerContext): Promise<void> {
    await ctx.tx.insert(tests).values({
      id: event.payload.testId,
      suiteId: event.payload.suiteId,
      runId: event.runId,
      organizationId: ctx.organizationId,
      name: event.payload.testName,
      status: TestStatus.Pending,
      startedAt: new Date(event.timestamp),
    });

    this.logger.log(`Created test ${event.payload.testId} in run ${event.runId}`);
  }
}
