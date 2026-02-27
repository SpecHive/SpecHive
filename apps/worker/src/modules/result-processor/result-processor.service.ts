import { type Database, setTenantContext } from '@assertly/database';
import type { Transaction } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import { EnrichedEventEnvelopeSchema, type V1Event } from '@assertly/reporter-core-protocol';
import { type OrganizationId, type ProjectId } from '@assertly/shared-types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { INBOXY_CLIENT, type InboxyClient } from '@outboxy/sdk-nestjs';

import type { OutboxyEnvelope } from '../../types/outboxy-envelope';

import {
  ArtifactUploadHandler,
  RunEndHandler,
  RunStartHandler,
  SuiteEndHandler,
  SuiteStartHandler,
  TestEndHandler,
  TestStartHandler,
} from './handlers';

@Injectable()
export class ResultProcessorService {
  private readonly logger = new Logger(ResultProcessorService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(INBOXY_CLIENT) private readonly inbox: InboxyClient<Transaction>,
    private readonly runStartHandler: RunStartHandler,
    private readonly runEndHandler: RunEndHandler,
    private readonly suiteStartHandler: SuiteStartHandler,
    private readonly suiteEndHandler: SuiteEndHandler,
    private readonly testStartHandler: TestStartHandler,
    private readonly testEndHandler: TestEndHandler,
    private readonly artifactUploadHandler: ArtifactUploadHandler,
  ) {}

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

      const ctx = {
        tx,
        organizationId: organizationId as OrganizationId,
        projectId: projectId as ProjectId,
      };

      await this.routeEvent(event, ctx);
    });
  }

  private async routeEvent(
    event: V1Event,
    ctx: { tx: Transaction; organizationId: OrganizationId; projectId: ProjectId },
  ): Promise<void> {
    switch (event.eventType) {
      case 'run.start':
        return this.runStartHandler.handle(event, ctx);
      case 'run.end':
        return this.runEndHandler.handle(event, ctx);
      case 'suite.start':
        return this.suiteStartHandler.handle(event, ctx);
      case 'suite.end':
        return this.suiteEndHandler.handle(event, ctx);
      case 'test.start':
        return this.testStartHandler.handle(event, ctx);
      case 'test.end':
        return this.testEndHandler.handle(event, ctx);
      case 'artifact.upload':
        return this.artifactUploadHandler.handle(event, ctx);
      default:
        // Exhaustive check — if all event types are handled, this is unreachable
        this.logger.warn(`Unknown event type: ${(event as V1Event).eventType}`);
    }
  }
}
