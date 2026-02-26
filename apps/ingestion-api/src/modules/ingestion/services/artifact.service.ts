import { artifacts } from '@assertly/database';
import type { Transaction } from '@assertly/database';
import type { ArtifactUploadEvent } from '@assertly/reporter-core-protocol';
import type { OrganizationId, ProjectId, RunId } from '@assertly/shared-types';
import { Injectable, Logger } from '@nestjs/common';

import { verifyRunOwnership } from './verify-run-ownership';

@Injectable()
export class ArtifactService {
  private readonly logger = new Logger(ArtifactService.name);

  async handleArtifactUpload(
    event: ArtifactUploadEvent,
    projectId: ProjectId,
    organizationId: OrganizationId,
    tx: Transaction,
  ): Promise<{ runId: RunId }> {
    await verifyRunOwnership(event.runId, projectId, tx);

    // Sprint 1: real MinIO upload. For now, store metadata with a placeholder path.
    await tx.insert(artifacts).values({
      testId: event.payload.testId,
      organizationId,
      type: event.payload.artifactType,
      name: event.payload.name,
      storagePath: `placeholder://${event.runId}/${event.payload.testId}/${event.payload.name}`,
      mimeType: event.payload.mimeType ?? null,
    });

    this.logger.log(`Created artifact record for test ${event.payload.testId}`);
    return { runId: event.runId };
  }
}
