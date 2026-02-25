import { artifacts, runs } from '@assertly/database';
import type { Database } from '@assertly/database';
import type { ArtifactUploadEvent } from '@assertly/reporter-core-protocol';
import type { ProjectId, RunId } from '@assertly/shared-types';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

@Injectable()
export class ArtifactService {
  private readonly logger = new Logger(ArtifactService.name);

  async handleArtifactUpload(
    event: ArtifactUploadEvent,
    projectId: ProjectId,
    tx: Database,
  ): Promise<{ runId: RunId }> {
    const [run] = await tx
      .select({ projectId: runs.projectId })
      .from(runs)
      .where(eq(runs.id, event.runId))
      .limit(1);

    if (!run || run.projectId !== projectId) {
      throw new NotFoundException(`Run ${event.runId} not found in project`);
    }

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
}
