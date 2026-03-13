import { basename } from 'node:path';

import { Injectable } from '@nestjs/common';
import { S3Service } from '@spechive/nestjs-common';
import type { ArtifactId, OrganizationId, ProjectId } from '@spechive/shared-types';
import { asArtifactId, sanitizeArtifactName } from '@spechive/shared-types';
import { uuidv7 } from 'uuidv7';

import type { PresignRequest } from './presign-request.schema';

const PRESIGN_EXPIRY_SECONDS = 300;

export interface PresignedUploadResult {
  artifactId: ArtifactId;
  storagePath: string;
  uploadUrl: string;
  expiresIn: number;
}

@Injectable()
export class ArtifactsService {
  constructor(private readonly s3: S3Service) {}

  async createPresignedUpload(
    request: PresignRequest,
    projectId: ProjectId,
    organizationId: OrganizationId,
  ): Promise<PresignedUploadResult> {
    const artifactId = asArtifactId(uuidv7());
    const safeName = sanitizeArtifactName(basename(request.fileName));
    const storagePath = `${organizationId}/${projectId}/${request.runId}/${request.testId}/${artifactId}_${safeName}`;

    const uploadUrl = await this.s3.getPresignedUploadUrl(
      storagePath,
      request.contentType,
      PRESIGN_EXPIRY_SECONDS,
    );

    return { artifactId, storagePath, uploadUrl, expiresIn: PRESIGN_EXPIRY_SECONDS };
  }
}
