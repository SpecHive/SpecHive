import { Injectable } from '@nestjs/common';
import { artifacts } from '@spechive/database';
import { RetryableError, S3Service } from '@spechive/nestjs-common';
import { InjectPinoLogger, PinoLogger } from '@spechive/nestjs-common';
import type { ArtifactUploadEvent } from '@spechive/reporter-core-protocol';

import { EventHandler } from './event-handler.decorator';
import type { EventHandlerContext, IEventHandler } from './event-handler.interface';

@EventHandler()
@Injectable()
export class ArtifactUploadHandler implements IEventHandler<ArtifactUploadEvent> {
  readonly eventType = 'artifact.upload' as const;

  constructor(
    @InjectPinoLogger(ArtifactUploadHandler.name) private readonly logger: PinoLogger,
    private readonly s3: S3Service,
  ) {}

  async handle(event: ArtifactUploadEvent, ctx: EventHandlerContext): Promise<void> {
    const { artifactId, storagePath, testId, artifactType, name, mimeType, retryIndex } =
      event.payload;
    const expectedPrefix = `${ctx.organizationId}/${ctx.projectId}/`;

    if (!storagePath.startsWith(expectedPrefix)) {
      this.logger.error(
        { artifactId, storagePath, expectedPrefix },
        'Artifact has invalid storage path prefix',
      );
      return;
    }

    const head = await this.s3.headObject(storagePath);
    if (!head.exists) {
      throw new RetryableError(`Artifact ${artifactId} not found in S3 at "${storagePath}"`);
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

    this.logger.info({ artifactId, bytes: head.contentLength ?? 0, testId }, 'Artifact stored');
  }
}
