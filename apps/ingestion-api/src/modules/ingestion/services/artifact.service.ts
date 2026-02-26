import { artifacts } from '@assertly/database';
import type { Transaction } from '@assertly/database';
import type { ArtifactUploadEvent } from '@assertly/reporter-core-protocol';
import type { ProjectId, RunId } from '@assertly/shared-types';
import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires value import
import { ConfigService } from '@nestjs/config';

import { verifyRunOwnership } from './verify-run-ownership';

@Injectable()
export class ArtifactService {
  private readonly logger = new Logger(ArtifactService.name);

  constructor(private readonly config: ConfigService) {}

  async handleArtifactUpload(
    event: ArtifactUploadEvent,
    projectId: ProjectId,
    tx: Transaction,
  ): Promise<{ runId: RunId }> {
    await verifyRunOwnership(event.runId, projectId, tx);

    if (this.config.get('NODE_ENV') === 'production') {
      throw new NotImplementedException('Artifact storage not yet implemented');
    }

    // Artifact binary data (event.payload.data) is accepted but not stored.
    // Real upload to MinIO deferred to Sprint 1.
    // The 202 response acknowledges receipt of metadata only.
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
