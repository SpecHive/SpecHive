import { Injectable } from '@nestjs/common';
import { tests } from '@spechive/database';
import { InjectPinoLogger, PinoLogger } from '@spechive/nestjs-common';
import type { TestStartEvent } from '@spechive/reporter-core-protocol';
import { TestStatus } from '@spechive/shared-types';

import { EventHandler } from './event-handler.decorator';
import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

@EventHandler()
@Injectable()
export class TestStartHandler implements IEventHandler<TestStartEvent> {
  readonly eventType = 'test.start' as const;

  constructor(@InjectPinoLogger(TestStartHandler.name) private readonly logger: PinoLogger) {}

  async handle(event: TestStartEvent, ctx: EventHandlerContext): Promise<void> {
    const result = await ctx.tx
      .insert(tests)
      .values({
        id: event.payload.testId,
        suiteId: event.payload.suiteId,
        runId: event.runId,
        organizationId: ctx.organizationId,
        name: event.payload.testName,
        status: TestStatus.Pending,
        startedAt: new Date(event.timestamp),
        // Explicit createdAt for deterministic dedup with composite PK (id, created_at).
        // Replayed events carry the same timestamp, so (id, createdAt) will conflict correctly.
        createdAt: new Date(event.timestamp),
      })
      .onConflictDoNothing()
      .returning({ id: tests.id });

    if (result.length === 0) {
      this.logger.debug({ testId: event.payload.testId }, 'Duplicate test.start skipped');
      return;
    }

    this.logger.info({ testId: event.payload.testId, runId: event.runId }, 'Test created');
  }
}
