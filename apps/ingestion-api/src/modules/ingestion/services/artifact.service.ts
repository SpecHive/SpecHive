import { artifacts } from '@assertly/database';
import type { Transaction } from '@assertly/database';
import type { ArtifactUploadEvent } from '@assertly/reporter-core-protocol';
import type { OrganizationId, ProjectId, RunId } from '@assertly/shared-types';
import { Injectable, Logger } from '@nestjs/common';

import { verifyRunOwnership } from './verify-run-ownership';

/** Temporary prefix until MinIO upload is implemented in Sprint 1 */
const PLACEHOLDER_STORAGE_PREFIX = 'placeholder://';

const MAX_ARTIFACT_NAME_LENGTH = 255;

function sanitizeArtifactName(name: string): string {
  return name
    .replace(/%2e%2e|%2f|%5c|%00/gi, '_')
    .replace(/\0/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[/\\]/g, '_')
    .replace(/[<>:"|?*]/g, '_')
    .slice(0, MAX_ARTIFACT_NAME_LENGTH);
}

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
