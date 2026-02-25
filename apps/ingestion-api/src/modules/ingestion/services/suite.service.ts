import { suites } from '@assertly/database';
import type { Transaction } from '@assertly/database';
import type { SuiteEndEvent, SuiteStartEvent } from '@assertly/reporter-core-protocol';
import type { ProjectId, RunId } from '@assertly/shared-types';
import { Injectable, Logger } from '@nestjs/common';

import { verifyRunOwnership } from './verify-run-ownership';

@Injectable()
export class SuiteService {
  private readonly logger = new Logger(SuiteService.name);

  async handleSuiteStart(
    event: SuiteStartEvent,
    projectId: ProjectId,
    tx: Transaction,
  ): Promise<{ runId: RunId }> {
    await verifyRunOwnership(event.runId, projectId, tx);

    await tx.insert(suites).values({
      id: event.payload.suiteId,
      runId: event.runId,
      name: event.payload.suiteName,
      parentSuiteId: event.payload.parentSuiteId ?? null,
    });

    this.logger.log(`Created suite ${event.payload.suiteId}`);
    return { runId: event.runId };
  }

  async handleSuiteEnd(
    event: SuiteEndEvent,
    projectId: ProjectId,
    tx: Transaction,
  ): Promise<{ runId: RunId }> {
    await verifyRunOwnership(event.runId, projectId, tx);

    this.logger.log(`Suite ${event.payload.suiteId} ended`);
    return { runId: event.runId };
  }
}
