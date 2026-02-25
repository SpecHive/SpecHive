import { createHash } from 'node:crypto';

import { runs, suites, tests, artifacts, projectTokens } from '@assertly/database';
import { type Database } from '@assertly/database';
import { type V1Event } from '@assertly/reporter-core-protocol';
import { RunStatus, TestStatus } from '@assertly/shared-types';
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { OutboxyClient } from '@outboxy/sdk-nestjs';
import { OUTBOXY_CLIENT } from '@outboxy/sdk-nestjs';
import { eq, and, isNull } from 'drizzle-orm';

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
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    @Inject(OUTBOXY_CLIENT)
    private readonly outboxy: OutboxyClient<PostgresTransaction>,
  ) {}

  async processEvent(event: V1Event): Promise<{ runId: string }> {
    return this.db.transaction(async (tx) => {
      const result = await this.handleEvent(event, tx as unknown as Database);

      // Publish to outbox inside the same transaction via the underlying postgres-js client
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

  private async handleEvent(event: V1Event, tx: Database): Promise<{ runId: string }> {
    switch (event.eventType) {
      case 'run.start': {
        const tokenHash = createHash('sha256').update(event.payload.projectToken).digest('hex');

        const project = await tx
          .select({ projectId: projectTokens.projectId })
          .from(projectTokens)
          .where(and(eq(projectTokens.tokenHash, tokenHash), isNull(projectTokens.revokedAt)))
          .limit(1);

        if (project.length === 0) {
          throw new UnauthorizedException('Invalid project token');
        }

        const projectId = project[0]!.projectId;

        await tx.insert(runs).values({
          id: event.runId,
          projectId,
          status: RunStatus.Pending,
          startedAt: new Date(event.timestamp),
          metadata: (event.payload.metadata ?? null) as Record<string, unknown> | null,
        });

        this.logger.log(`Created run ${event.runId}`);
        return { runId: event.runId };
      }

      case 'run.end': {
        await tx
          .update(runs)
          .set({
            status: event.payload.status,
            finishedAt: new Date(event.timestamp),
            updatedAt: new Date(),
          })
          .where(eq(runs.id, event.runId));

        this.logger.log(`Updated run ${event.runId} status to ${event.payload.status}`);
        return { runId: event.runId };
      }

      case 'suite.start': {
        await tx.insert(suites).values({
          id: event.payload.suiteId,
          runId: event.runId,
          name: event.payload.suiteName,
          parentSuiteId: event.payload.parentSuiteId ?? null,
        });

        this.logger.log(`Created suite ${event.payload.suiteId}`);
        return { runId: event.runId };
      }

      case 'suite.end': {
        // No-op for now — suite completion tracking deferred to Sprint 1
        this.logger.log(`Suite ${event.payload.suiteId} ended`);
        return { runId: event.runId };
      }

      case 'test.start': {
        await tx.insert(tests).values({
          id: event.payload.testId,
          suiteId: event.payload.suiteId,
          runId: event.runId,
          name: event.payload.testName,
          status: TestStatus.Pending,
          startedAt: new Date(event.timestamp),
        });

        this.logger.log(`Created test ${event.payload.testId}`);
        return { runId: event.runId };
      }

      case 'test.end': {
        await tx
          .update(tests)
          .set({
            status: event.payload.status,
            durationMs: event.payload.durationMs ?? null,
            errorMessage: event.payload.errorMessage ?? null,
            stackTrace: event.payload.stackTrace ?? null,
            retryCount: event.payload.retryCount ?? 0,
            finishedAt: new Date(event.timestamp),
            updatedAt: new Date(),
          })
          .where(eq(tests.id, event.payload.testId));

        this.logger.log(`Updated test ${event.payload.testId} status to ${event.payload.status}`);
        return { runId: event.runId };
      }

      case 'artifact.upload': {
        // Placeholder storage path — real upload logic deferred to Sprint 1
        await tx.insert(artifacts).values({
          testId: event.payload.testId,
          type: event.payload.artifactType,
          name: event.payload.name,
          storagePath: `placeholder://${event.runId}/${event.payload.testId}/${event.payload.name}`,
          mimeType: event.payload.mimeType ?? null,
        });

        this.logger.log(`Created artifact record for test ${event.payload.testId}`);
        return { runId: event.runId };
      }

      default: {
        const _exhaustive: never = event;
        throw _exhaustive;
      }
    }
  }
}
