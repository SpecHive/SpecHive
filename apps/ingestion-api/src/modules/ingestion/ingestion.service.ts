import { type Database, setTenantContext, type Transaction } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import { type V1Event } from '@assertly/reporter-core-protocol';
import type { OrganizationId, ProjectId, RunId } from '@assertly/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import type { OutboxyClient } from '@outboxy/sdk-nestjs';
import { OUTBOXY_CLIENT } from '@outboxy/sdk-nestjs';

import { ArtifactService } from './services/artifact.service';
import { RunService } from './services/run.service';
import { SuiteService } from './services/suite.service';
import { TestService } from './services/test.service';

@Injectable()
export class IngestionService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    @Inject(OUTBOXY_CLIENT)
    private readonly outboxy: OutboxyClient<Transaction>,
    private readonly runService: RunService,
    private readonly suiteService: SuiteService,
    private readonly testService: TestService,
    private readonly artifactService: ArtifactService,
  ) {}

  async processEvent(
    event: V1Event,
    projectId: ProjectId,
    organizationId: OrganizationId,
  ): Promise<{ runId: RunId }> {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);
      const result = await this.handleEvent(event, projectId, organizationId, tx);

      await this.outboxy.publish(
        {
          // Sprint 1: derive aggregateType from event type when multiple aggregates exist
          aggregateType: 'TestRun',
          aggregateId: event.runId,
          eventType: event.eventType,
          payload: event as unknown as Record<string, unknown>,
          idempotencyKey: `${event.runId}:${event.eventType}:${this.getEventEntityId(event)}:${event.timestamp}`,
        },
        tx,
      );

      return result;
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

  private async handleEvent(
    event: V1Event,
    projectId: ProjectId,
    organizationId: OrganizationId,
    tx: Transaction,
  ): Promise<{ runId: RunId }> {
    switch (event.eventType) {
      case 'run.start':
        return this.runService.handleRunStart(event, projectId, organizationId, tx);
      case 'run.end':
        return this.runService.handleRunEnd(event, projectId, tx);
      case 'suite.start':
        return this.suiteService.handleSuiteStart(event, projectId, organizationId, tx);
      case 'suite.end':
        return this.suiteService.handleSuiteEnd(event, projectId, tx);
      case 'test.start':
        return this.testService.handleTestStart(event, projectId, organizationId, tx);
      case 'test.end':
        return this.testService.handleTestEnd(event, projectId, tx);
      case 'artifact.upload':
        return this.artifactService.handleArtifactUpload(event, projectId, organizationId, tx);
      default: {
        const _exhaustive: never = event;
        throw _exhaustive;
      }
    }
  }
}
