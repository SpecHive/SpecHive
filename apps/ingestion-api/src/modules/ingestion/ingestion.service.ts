import { type Database, setTenantContext, type Transaction } from '@assertly/database';
import { type V1Event } from '@assertly/reporter-core-protocol';
import type { OrganizationId, ProjectId, RunId } from '@assertly/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import type { OutboxyClient } from '@outboxy/sdk-nestjs';
import { OUTBOXY_CLIENT } from '@outboxy/sdk-nestjs';

import { DATABASE_CONNECTION } from '../../constants';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires value import
import { ArtifactService } from './services/artifact.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires value import
import { RunService } from './services/run.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires value import
import { SuiteService } from './services/suite.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires value import
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
      const txDb = tx as unknown as Database;
      const result = await this.handleEvent(event, projectId, txDb);

      await this.outboxy.publish(
        {
          aggregateType: 'TestRun',
          aggregateId: event.runId,
          eventType: event.eventType,
          payload: event as unknown as Record<string, unknown>,
          idempotencyKey: `${event.runId}:${event.eventType}:${event.timestamp}`,
        },
        tx,
      );

      return result;
    });
  }

  private async handleEvent(
    event: V1Event,
    projectId: ProjectId,
    tx: Database,
  ): Promise<{ runId: RunId }> {
    switch (event.eventType) {
      case 'run.start':
        return this.runService.handleRunStart(event, projectId, tx);
      case 'run.end':
        return this.runService.handleRunEnd(event, projectId, tx);
      case 'suite.start':
        return this.suiteService.handleSuiteStart(event, projectId, tx);
      case 'suite.end':
        return this.suiteService.handleSuiteEnd(event, projectId, tx);
      case 'test.start':
        return this.testService.handleTestStart(event, projectId, tx);
      case 'test.end':
        return this.testService.handleTestEnd(event, projectId, tx);
      case 'artifact.upload':
        return this.artifactService.handleArtifactUpload(event, projectId, tx);
      default: {
        const _exhaustive: never = event;
        throw _exhaustive;
      }
    }
  }
}
