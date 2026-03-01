import { type Database, setTenantContext } from '@assertly/database';
import type { Transaction } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import { EnrichedEventEnvelopeSchema, type V1Event } from '@assertly/reporter-core-protocol';
import { type OrganizationId, type ProjectId } from '@assertly/shared-types';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { INBOXY_CLIENT, type InboxyClient } from '@outboxy/sdk-nestjs';

import type { OutboxyEnvelope } from '../../types/outboxy-envelope';

import { EVENT_HANDLER, type EventHandlerContext, type IEventHandler } from './handlers';

@Injectable()
export class ResultProcessorService implements OnModuleInit {
  private readonly logger = new Logger(ResultProcessorService.name);
  private handlerMap!: Map<V1Event['eventType'], IEventHandler>;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(INBOXY_CLIENT) private readonly inbox: InboxyClient<Transaction>,
    @Inject(EVENT_HANDLER) private readonly handlers: IEventHandler[],
  ) {}

  onModuleInit(): void {
    this.handlerMap = new Map(this.handlers.map((h) => [h.eventType, h]));
  }

  async processEvent(envelope: OutboxyEnvelope): Promise<void> {
    const parsed = EnrichedEventEnvelopeSchema.safeParse(envelope.payload);

    if (!parsed.success) {
      this.logger.error(`Invalid event envelope (id=${envelope.id}): ${parsed.error.message}`);
      return;
    }

    const { event, organizationId, projectId } = parsed.data;

    await this.db.transaction(async (tx) => {
      const result = await this.inbox.receive(
        {
          idempotencyKey: envelope.id,
          aggregateType: envelope.aggregateType,
          aggregateId: envelope.aggregateId,
          eventType: envelope.eventType,
          payload: envelope.payload,
        },
        tx,
      );

      if (result.status === 'duplicate') {
        this.logger.warn(`Duplicate event skipped (id=${envelope.id})`);
        return;
      }

      await setTenantContext(tx, organizationId as OrganizationId);

      const ctx: EventHandlerContext = {
        tx,
        organizationId: organizationId as OrganizationId,
        projectId: projectId as ProjectId,
      };

      await this.routeEvent(event, ctx);
    });
  }

  private async routeEvent(event: V1Event, ctx: EventHandlerContext): Promise<void> {
    const handler = this.handlerMap.get(event.eventType);

    if (handler) {
      return handler.handle(event, ctx);
    }

    this.logger.warn(`Unknown event type: ${event.eventType}`);
  }
}
