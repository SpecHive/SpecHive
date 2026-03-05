import { artifacts } from '@assertly/database';
import { S3Service } from '@assertly/nestjs-common';
import type { ArtifactUploadEvent } from '@assertly/reporter-core-protocol';
import { asArtifactId, sanitizeArtifactName } from '@assertly/shared-types';
import { Injectable, Logger } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';

import { EventHandler } from './event-handler.decorator';
import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

const LARGE_ARTIFACT_BYTES = 5 * 1024 * 1024;

@EventHandler()
@Injectable()
export class ArtifactUploadHandler implements IEventHandler<ArtifactUploadEvent> {
  readonly eventType = 'artifact.upload' as const;
  private readonly logger = new Logger(ArtifactUploadHandler.name);

  constructor(private readonly s3: S3Service) {}

  async handle(event: ArtifactUploadEvent, ctx: EventHandlerContext): Promise<void> {
    const artifactId = asArtifactId(uuidv7());
    const buffer = Buffer.from(event.payload.data, 'base64');
    const sizeBytes = buffer.length;
    const safeName = sanitizeArtifactName(event.payload.name);
    const storagePath = `${ctx.organizationId}/${ctx.projectId}/${event.runId}/${event.payload.testId}/${artifactId}/${safeName}`;

    if (sizeBytes > LARGE_ARTIFACT_BYTES) {
      this.logger.warn(
        `Artifact ${artifactId} is ${(sizeBytes / 1024 / 1024).toFixed(1)}MB — exceeds 5MB threshold`,
      );
    }

    let finalStoragePath = storagePath;
    try {
      await this.s3.upload(storagePath, buffer, event.payload.mimeType);
    } catch (error) {
      this.logger.error(`S3 upload failed for artifact ${artifactId}: ${error}`);
      finalStoragePath = `failed://${storagePath}`;
    }

    await ctx.tx.insert(artifacts).values({
      id: artifactId,
      testId: event.payload.testId,
      organizationId: ctx.organizationId,
      type: event.payload.artifactType,
      name: safeName,
      storagePath: finalStoragePath,
      sizeBytes,
      mimeType: event.payload.mimeType ?? null,
    });

    this.logger.log(`Stored artifact ${artifactId} for test ${event.payload.testId}`);
  }
}
