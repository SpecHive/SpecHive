import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { INBOXY_CLIENT, type InboxyClient } from '@outboxy/sdk-nestjs';
import { type Database, setTenantContext } from '@spechive/database';
import type { Transaction } from '@spechive/database';
import {
  DATABASE_CONNECTION,
  DEFAULT_RETRYABLE_PG_CODES,
  RetryableError,
  extractPgError,
} from '@spechive/nestjs-common';
import { InjectPinoLogger, PinoLogger } from '@spechive/nestjs-common';
import { EnrichedEventEnvelopeSchema, type V1Event } from '@spechive/reporter-core-protocol';
import { type OrganizationId, type ProjectId } from '@spechive/shared-types';

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
  private handlerMap!: Map<V1Event['eventType'], IEventHandler>;

  constructor(
    @InjectPinoLogger(ResultProcessorService.name) private readonly logger: PinoLogger,
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
    this.logger.info({ count: this.handlerMap.size }, 'Event handlers discovered');
  }

  async processEvent(envelope: OutboxyEvent): Promise<void> {
    const parsed = EnrichedEventEnvelopeSchema.safeParse(envelope.payload);

    if (!parsed.success) {
      this.logger.error({ err: parsed.error, eventId: envelope.eventId }, 'Invalid event envelope');
      return;
    }

    const { event, organizationId, projectId } = parsed.data;

    try {
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
          this.logger.warn({ eventId: envelope.eventId }, 'Duplicate event skipped');
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
    } catch (error) {
      // Already classified by handler (e.g., artifact S3 not found) — propagate as-is.
      // Guard also prevents double-wrapping: RetryableError with a PG cause would
      // match the retryable check below and get wrapped again without this check.
      if (error instanceof RetryableError) throw error;

      // Auto-classify known PG errors as retryable (cross-batch dependency ordering).
      const pgErr = extractPgError(error);
      if (pgErr && DEFAULT_RETRYABLE_PG_CODES.has(pgErr.code)) {
        throw new RetryableError(
          `Dependency not ready for ${envelope.eventType} (eventId=${envelope.eventId})`,
          { cause: error },
        );
      }

      // Permanent failure — propagate for ERROR logging in the controller.
      throw error;
    }
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

    this.logger.warn({ eventType: event.eventType }, 'Unknown event type');
  }
}
