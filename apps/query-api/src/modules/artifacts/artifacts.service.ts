import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Database } from '@spechive/database';
import { artifacts, setTenantContext } from '@spechive/database';
import { DATABASE_CONNECTION, S3Service } from '@spechive/nestjs-common';
import type { ArtifactId, OrganizationId } from '@spechive/shared-types';
import { eq } from 'drizzle-orm';

const PRESIGNED_URL_EXPIRY_SECONDS = 900;

@Injectable()
export class ArtifactsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly s3: S3Service,
  ) {}

  async getDownloadUrl(organizationId: OrganizationId, artifactId: ArtifactId) {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const [artifact] = await tx
        .select({
          id: artifacts.id,
          storagePath: artifacts.storagePath,
          name: artifacts.name,
        })
        .from(artifacts)
        .where(eq(artifacts.id, artifactId))
        .limit(1);

      if (!artifact) {
        throw new NotFoundException(`Artifact ${artifactId} not found`);
      }

      if (artifact.storagePath.startsWith('failed://')) {
        throw new BadRequestException('Artifact upload failed');
      }

      const url = await this.s3.getPresignedDownloadUrl(
        artifact.storagePath,
        PRESIGNED_URL_EXPIRY_SECONDS,
      );

      return { url, expiresIn: PRESIGNED_URL_EXPIRY_SECONDS };
    });
  }
}
