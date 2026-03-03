import { type Database, type Transaction } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import { type V1Event } from '@assertly/reporter-core-protocol';
import type { OrganizationId, ProjectId } from '@assertly/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import type { OutboxyClient } from '@outboxy/sdk-nestjs';
import { OUTBOXY_CLIENT } from '@outboxy/sdk-nestjs';

@Injectable()
export class IngestionService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    @Inject(OUTBOXY_CLIENT)
    private readonly outboxy: OutboxyClient<Transaction>,
  ) {}

  async processEvent(
    event: V1Event,
    projectId: ProjectId,
    organizationId: OrganizationId,
  ): Promise<{ eventId: string }> {
    return this.db.transaction(async (tx) => {
      const idempotencyParts = [
        event.runId,
        event.eventType.replace(/\./g, '_'),
        this.getEventEntityId(event),
        new Date(event.timestamp).getTime(),
      ];
      const idempotencyKey = idempotencyParts.join('-');
      const eventId = await this.outboxy.publish(
        {
          aggregateType: 'TestRun',
          aggregateId: event.runId,
          eventType: event.eventType,
          payload: { event, organizationId, projectId } as unknown as Record<string, unknown>,
          idempotencyKey,
        },
        tx,
      );

      return { eventId };
    });
  }

  private getEventEntityId(event: V1Event): string {
    switch (event.eventType) {
      case 'run.start':
      case 'run.end':
        return event.runId;
      case 'suite.start':
      case 'suite.end':
        return event.payload.suiteId;
      case 'test.start':
      case 'test.end':
        return event.payload.testId;
      case 'artifact.upload':
        return event.payload.testId;
      default: {
        const _exhaustive: never = event;
        throw _exhaustive;
      }
    }
  }
}
