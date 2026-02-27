import { artifacts } from '@assertly/database';
import type { Transaction } from '@assertly/database';
import type { ArtifactUploadEvent } from '@assertly/reporter-core-protocol';
import type { OrganizationId, ProjectId, RunId } from '@assertly/shared-types';
import { sanitizeArtifactName } from '@assertly/shared-types';
import { Injectable, Logger } from '@nestjs/common';

import { verifyRunOwnership } from './verify-run-ownership';

/** Temporary prefix until MinIO upload is implemented in Sprint 1 */
const PLACEHOLDER_STORAGE_PREFIX = 'placeholder://';

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

    const safeName = sanitizeArtifactName(event.payload.name);

    await tx.insert(artifacts).values({
      testId: event.payload.testId,
      organizationId,
      type: event.payload.artifactType,
      name: safeName,
      storagePath: `${PLACEHOLDER_STORAGE_PREFIX}${event.runId}/${event.payload.testId}/${safeName}`,
      mimeType: event.payload.mimeType ?? null,
    });

    this.logger.log(`Created artifact record for test ${event.payload.testId}`);
    return { runId: event.runId };
  }
}
