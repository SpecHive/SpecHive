import { tests } from '@assertly/database';
import type { TestStartEvent } from '@assertly/reporter-core-protocol';
import { TestStatus } from '@assertly/shared-types';
import { Injectable, Logger } from '@nestjs/common';

import { EventHandler } from './event-handler.decorator';
import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

@EventHandler()
@Injectable()
export class TestStartHandler implements IEventHandler<TestStartEvent> {
  readonly eventType = 'test.start' as const;
  private readonly logger = new Logger(TestStartHandler.name);

  async handle(event: TestStartEvent, ctx: EventHandlerContext): Promise<void> {
    await ctx.tx
      .insert(tests)
      .values({
        id: event.payload.testId,
        suiteId: event.payload.suiteId,
        runId: event.runId,
        organizationId: ctx.organizationId,
        name: event.payload.testName,
        status: TestStatus.Pending,
        startedAt: new Date(event.timestamp),
      })
      .onConflictDoNothing({ target: tests.id });

    this.logger.log(`Created test ${event.payload.testId} in run ${event.runId}`);
  }
}
