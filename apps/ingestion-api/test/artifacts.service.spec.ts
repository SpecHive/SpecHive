import { Test } from '@nestjs/testing';
import { S3Service } from '@spechive/nestjs-common';
import type { OrganizationId, ProjectId } from '@spechive/shared-types';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ArtifactsService } from '../src/modules/artifacts/artifacts.service';

describe('ArtifactsService', () => {
  let service: ArtifactsService;
  let mockGetPresignedUploadUrl: ReturnType<typeof vi.fn>;

  const PROJECT_ID = 'proj-1' as ProjectId;
  const ORG_ID = 'org-1' as OrganizationId;

  beforeEach(async () => {
    mockGetPresignedUploadUrl = vi.fn().mockResolvedValue('https://s3.example.com/presigned');

    const module = await Test.createTestingModule({
      providers: [
        ArtifactsService,
        { provide: S3Service, useValue: { getPresignedUploadUrl: mockGetPresignedUploadUrl } },
      ],
    }).compile();

    service = module.get(ArtifactsService);
  });

  it('generates correct storage path format', async () => {
    const result = await service.createPresignedUpload(
      {
        runId: 'run-1',
        testId: 'test-1',
        fileName: 'screenshot.png',
        contentType: 'image/png',
        sizeBytes: 1024,
      },
      PROJECT_ID,
      ORG_ID,
    );

    expect(result.storagePath).toMatch(
      /^org-1\/proj-1\/run-1\/test-1\/[0-9a-f-]+_screenshot\.png$/,
    );
    expect(result.artifactId).toBeDefined();
    expect(result.uploadUrl).toBe('https://s3.example.com/presigned');
    expect(result.expiresIn).toBe(300);
  });

  it('sanitizes file names with directory traversal', async () => {
    const result = await service.createPresignedUpload(
      {
        runId: 'run-1',
        testId: 'test-1',
        fileName: '../../../etc/passwd',
        contentType: 'text/plain',
        sizeBytes: 100,
      },
      PROJECT_ID,
      ORG_ID,
    );

    expect(result.storagePath).not.toContain('..');
    expect(result.storagePath).not.toContain('/etc/');
  });

  it('calls S3 service with correct arguments', async () => {
    await service.createPresignedUpload(
      {
        runId: 'run-1',
        testId: 'test-1',
        fileName: 'trace.zip',
        contentType: 'application/zip',
        sizeBytes: 5000,
      },
      PROJECT_ID,
      ORG_ID,
    );

    expect(mockGetPresignedUploadUrl).toHaveBeenCalledWith(
      expect.stringContaining('org-1/proj-1/run-1/test-1/'),
      'application/zip',
      300,
    );
  });
});
