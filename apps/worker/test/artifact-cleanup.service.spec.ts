import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DATABASE_CONNECTION, S3Service } from '@spechive/nestjs-common';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createMockPinoLogger } from '../../../test/unit-helpers/mock-logger';
import { ArtifactCleanupService } from '../src/modules/artifact-cleanup/artifact-cleanup.service';

const mockExecute = vi.fn();

const mockTx = { execute: mockExecute };

const mockDb = {
  transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<void>) => cb(mockTx)),
};

const mockS3 = {
  deleteMany: vi.fn(),
};

const mockConfig = {
  get: vi.fn().mockReturnValue(90),
};

describe('ArtifactCleanupService', () => {
  let service: ArtifactCleanupService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        ArtifactCleanupService,
        { provide: DATABASE_CONNECTION, useValue: mockDb },
        { provide: S3Service, useValue: mockS3 },
        { provide: ConfigService, useValue: mockConfig },
        createMockPinoLogger('ArtifactCleanupService'),
      ],
    }).compile();

    service = module.get(ArtifactCleanupService);
  });

  it('skips cleanup when advisory lock is already held', async () => {
    mockExecute.mockResolvedValueOnce([{ locked: false }]);

    await service.cleanupExpiredArtifacts();

    expect(mockS3.deleteMany).not.toHaveBeenCalled();
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('skips deletion when no expired artifacts exist', async () => {
    mockExecute.mockResolvedValueOnce([{ locked: true }]);
    mockExecute.mockResolvedValueOnce([]);

    await service.cleanupExpiredArtifacts();

    expect(mockS3.deleteMany).not.toHaveBeenCalled();
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it('deletes expired artifacts from S3 then database', async () => {
    const expired = [
      { artifact_id: 'art-1', storage_path: 'org/proj/run/art1.png' },
      { artifact_id: 'art-2', storage_path: 'org/proj/run/art2.png' },
    ];
    mockExecute.mockResolvedValueOnce([{ locked: true }]);
    mockExecute.mockResolvedValueOnce(expired);
    mockExecute.mockResolvedValueOnce(undefined);
    mockExecute.mockResolvedValueOnce([]);
    mockS3.deleteMany.mockResolvedValueOnce(undefined);

    await service.cleanupExpiredArtifacts();

    expect(mockS3.deleteMany).toHaveBeenCalledWith([
      'org/proj/run/art1.png',
      'org/proj/run/art2.png',
    ]);
    expect(mockExecute).toHaveBeenCalledTimes(4);
  });

  it('stops processing on S3 failure', async () => {
    const batch = [{ artifact_id: 'art-1', storage_path: 'path/1.png' }];
    mockExecute.mockResolvedValueOnce([{ locked: true }]);
    mockExecute.mockResolvedValueOnce(batch);
    mockS3.deleteMany.mockRejectedValueOnce(new Error('S3 error'));

    await service.cleanupExpiredArtifacts();

    expect(mockS3.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it('stops processing on DB delete failure', async () => {
    const batch = [{ artifact_id: 'art-1', storage_path: 'path/1.png' }];
    mockExecute.mockResolvedValueOnce([{ locked: true }]);
    mockExecute.mockResolvedValueOnce(batch);
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    mockS3.deleteMany.mockResolvedValueOnce(undefined);

    await service.cleanupExpiredArtifacts();

    expect(mockS3.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledTimes(3);
  });

  it('respects ARTIFACT_RETENTION_DAYS from config', async () => {
    mockConfig.get.mockReturnValue(30);
    mockExecute.mockResolvedValueOnce([{ locked: true }]);
    mockExecute.mockResolvedValueOnce([]);

    await service.cleanupExpiredArtifacts();

    expect(mockConfig.get).toHaveBeenCalledWith('ARTIFACT_RETENTION_DAYS', { infer: true });
  });

  it('stops after MAX_ITERATIONS and logs warning', async () => {
    const batch = [{ artifact_id: 'art-1', storage_path: 'path/1.png' }];
    mockExecute.mockResolvedValueOnce([{ locked: true }]);
    mockExecute.mockResolvedValue(batch);
    mockS3.deleteMany.mockResolvedValue(undefined);

    await service.cleanupExpiredArtifacts();

    // 1 lock + 100 iterations * (1 fetch + 1 delete) = 201
    expect(mockExecute).toHaveBeenCalledTimes(201);
    expect(mockS3.deleteMany).toHaveBeenCalledTimes(100);
  });
});
