import { Injectable, Logger } from '@nestjs/common';
import { artifacts } from '@spechive/database';
import { S3Service } from '@spechive/nestjs-common';
import type { ArtifactUploadEvent } from '@spechive/reporter-core-protocol';

import { EventHandler } from './event-handler.decorator';
import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

@EventHandler()
@Injectable()
export class ArtifactUploadHandler implements IEventHandler<ArtifactUploadEvent> {
  readonly eventType = 'artifact.upload' as const;
  private readonly logger = new Logger(ArtifactUploadHandler.name);

  constructor(private readonly s3: S3Service) {}

  async handle(event: ArtifactUploadEvent, ctx: EventHandlerContext): Promise<void> {
    const { artifactId, storagePath, testId, artifactType, name, mimeType, retryIndex } =
      event.payload;
    const expectedPrefix = `${ctx.organizationId}/${ctx.projectId}/`;

    if (!storagePath.startsWith(expectedPrefix)) {
      this.logger.error(
        `Artifact ${artifactId} has invalid storage path prefix: expected "${expectedPrefix}", got "${storagePath}"`,
      );
      return;
    }

    const head = await this.s3.headObject(storagePath);
    if (!head.exists) {
      throw new Error(`Artifact ${artifactId} not found in S3 at "${storagePath}" — will retry`);
    }

    await ctx.tx.insert(artifacts).values({
      id: artifactId,
      testId,
      organizationId: ctx.organizationId,
      type: artifactType,
      name,
      storagePath,
      sizeBytes: head.contentLength ?? 0,
      retryIndex: retryIndex ?? null,
      mimeType: mimeType ?? null,
    });

    this.logger.log(
      `Stored artifact ${artifactId} (${head.contentLength ?? 0} bytes) for test ${testId}`,
    );
  }
}
