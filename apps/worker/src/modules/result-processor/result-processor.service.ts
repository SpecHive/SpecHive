import { type Database, setTenantContext } from '@assertly/database';
import type { Transaction } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import { EnrichedEventEnvelopeSchema, type V1Event } from '@assertly/reporter-core-protocol';
import { type OrganizationId, type ProjectId } from '@assertly/shared-types';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { INBOXY_CLIENT, type InboxyClient } from '@outboxy/sdk-nestjs';

import type { OutboxyEvent } from '../../types/outboxy-envelope';

import { EVENT_HANDLER_KEY, type EventHandlerContext, type IEventHandler } from './handlers';

const DEFAULT_EVENT_PRIORITY = 99;

const EVENT_PRIORITY: Record<string, number> = {
  'run.start': 1,
  'suite.start': 2,
  'test.start': 3,
  'test.end': 4,
  'artifact.upload': 5,
  'suite.end': 6,
  'run.end': 7,
};

@Injectable()
export class ResultProcessorService implements OnModuleInit {
  private readonly logger = new Logger(ResultProcessorService.name);
  private handlerMap!: Map<V1Event['eventType'], IEventHandler>;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(INBOXY_CLIENT) private readonly inbox: InboxyClient<Transaction>,
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    const handlers = this.discovery
      .getProviders()
      .filter((wrapper) => {
        if (!wrapper.metatype || !wrapper.isDependencyTreeStatic()) return false;
        return this.reflector.get(EVENT_HANDLER_KEY, wrapper.metatype) === true;
      })
      .map((wrapper) => wrapper.instance as IEventHandler);

    this.handlerMap = new Map(handlers.map((h) => [h.eventType, h]));
    this.logger.log(`Discovered ${this.handlerMap.size} event handlers`);
  }

  async processEvent(envelope: OutboxyEvent): Promise<void> {
    const parsed = EnrichedEventEnvelopeSchema.safeParse(envelope.payload);

    if (!parsed.success) {
      this.logger.error(
        `Invalid event envelope (eventId=${envelope.eventId}): ${parsed.error.message}`,
      );
      return;
    }

    const { event, organizationId, projectId } = parsed.data;

    await this.db.transaction(async (tx) => {
      const result = await this.inbox.receive(
        {
          idempotencyKey: envelope.eventId,
          aggregateType: envelope.aggregateType,
          aggregateId: envelope.aggregateId,
          eventType: envelope.eventType,
          payload: envelope.payload,
        },
        tx,
      );

      if (result.status === 'duplicate') {
        this.logger.warn(`Duplicate event skipped (eventId=${envelope.eventId})`);
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

  sortEventsByPriority(events: OutboxyEvent[]): OutboxyEvent[] {
    return [...events].sort(
      (a, b) =>
        (EVENT_PRIORITY[a.eventType] ?? DEFAULT_EVENT_PRIORITY) -
        (EVENT_PRIORITY[b.eventType] ?? DEFAULT_EVENT_PRIORITY),
    );
  }

  private async routeEvent(event: V1Event, ctx: EventHandlerContext): Promise<void> {
    const handler = this.handlerMap.get(event.eventType);

    if (handler) {
      return handler.handle(event, ctx);
    }

    this.logger.warn(`Unknown event type: ${event.eventType}`);
  }
}
