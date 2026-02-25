import { runs, suites } from '@assertly/database';
import type { Database } from '@assertly/database';
import type { SuiteEndEvent, SuiteStartEvent } from '@assertly/reporter-core-protocol';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

@Injectable()
export class SuiteService {
  private readonly logger = new Logger(SuiteService.name);

  async handleSuiteStart(
    event: SuiteStartEvent,
    projectId: string,
    tx: Database,
  ): Promise<{ runId: string }> {
    const [run] = await tx
      .select({ projectId: runs.projectId })
      .from(runs)
      .where(eq(runs.id, event.runId))
      .limit(1);

    if (!run || run.projectId !== projectId) {
      throw new NotFoundException(`Run ${event.runId} not found in project`);
    }

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
    projectId: string,
    tx: Database,
  ): Promise<{ runId: string }> {
    const [run] = await tx
      .select({ projectId: runs.projectId })
      .from(runs)
      .where(eq(runs.id, event.runId))
      .limit(1);

    if (!run || run.projectId !== projectId) {
      throw new NotFoundException(`Run ${event.runId} not found in project`);
    }

    this.logger.log(`Suite ${event.payload.suiteId} ended`);
    return { runId: event.runId };
  }
}
