import { type Database } from '@assertly/database';
import { type V1Event } from '@assertly/reporter-core-protocol';
import type { ProjectId, RunId } from '@assertly/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import type { OutboxyClient } from '@outboxy/sdk-nestjs';
import { OUTBOXY_CLIENT } from '@outboxy/sdk-nestjs';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ArtifactService } from './services/artifact.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RunService } from './services/run.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SuiteService } from './services/suite.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TestService } from './services/test.service';

export const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');

// postgres-js exposes an `unsafe` method on its transaction client for raw SQL
type PostgresTransaction = {
  unsafe: (sql: string, params?: unknown[]) => Promise<{ id: string }[]>;
};

// Drizzle wraps postgres-js and exposes the session's connection for raw SQL
type DrizzleTx = {
  [key: string]: unknown;
  $client: PostgresTransaction;
};

@Injectable()
export class IngestionService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    @Inject(OUTBOXY_CLIENT)
    private readonly outboxy: OutboxyClient<PostgresTransaction>,
    private readonly runService: RunService,
    private readonly suiteService: SuiteService,
    private readonly testService: TestService,
    private readonly artifactService: ArtifactService,
  ) {}

  async processEvent(event: V1Event, projectId: ProjectId): Promise<{ runId: RunId }> {
    return this.db.transaction(async (tx) => {
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
        (tx as unknown as DrizzleTx).$client,
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
