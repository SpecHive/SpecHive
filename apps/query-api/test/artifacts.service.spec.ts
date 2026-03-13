import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DATABASE_CONNECTION, S3Service } from '@spechive/nestjs-common';
import type { ArtifactId, OrganizationId } from '@spechive/shared-types';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ArtifactsService } from '../src/modules/artifacts/artifacts.service';

describe('ArtifactsService', () => {
  let service: ArtifactsService;
  const mockExecute = vi.fn();
  const mockSelect = vi.fn();
  const mockGetPresignedDownloadUrl = vi.fn();

  const mockTx = {
    execute: mockExecute,
    select: mockSelect,
  };

  const mockDb = {
    transaction: vi.fn((callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        ArtifactsService,
        { provide: DATABASE_CONNECTION, useValue: mockDb },
        {
          provide: S3Service,
          useValue: { getPresignedDownloadUrl: mockGetPresignedDownloadUrl },
        },
      ],
    }).compile();

    service = module.get(ArtifactsService);
  });

  it('throws 404 when artifact not found', async () => {
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    await expect(
      service.getDownloadUrl('org-1' as OrganizationId, 'non-existent' as ArtifactId),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequest for failed artifact', async () => {
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([{ id: 'art-1', storagePath: 'failed://error', name: 'file.png' }]),
        }),
      }),
    });

    await expect(
      service.getDownloadUrl('org-1' as OrganizationId, 'art-1' as ArtifactId),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns presigned URL for valid artifact', async () => {
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { id: 'art-1', storagePath: 'artifacts/org/test/file.png', name: 'file.png' },
            ]),
        }),
      }),
    });

    mockGetPresignedDownloadUrl.mockResolvedValue('https://minio.local/presigned-url');

    const result = await service.getDownloadUrl('org-1' as OrganizationId, 'art-1' as ArtifactId);

    expect(result.url).toBe('https://minio.local/presigned-url');
    expect(result.expiresIn).toBe(900);
    expect(mockGetPresignedDownloadUrl).toHaveBeenCalledWith('artifacts/org/test/file.png', 900);
  });
});
