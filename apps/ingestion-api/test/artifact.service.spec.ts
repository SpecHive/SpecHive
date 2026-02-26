import type { Database } from '@assertly/database';
import type { ProjectId, RunId, TestId } from '@assertly/shared-types';
import { NotImplementedException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ArtifactService } from '../src/modules/ingestion/services/artifact.service';

const PROJECT_ID = 'project-1' as ProjectId;
const RUN_ID = '00000000-0000-4000-a000-000000000001' as RunId;
const TEST_ID = '00000000-0000-4000-a000-000000000020' as TestId;
const TIMESTAMP = '2026-02-24T10:00:00.000Z';

function makeMockTx(runOwnerProjectId: ProjectId = PROJECT_ID) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ projectId: runOwnerProjectId }]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

function makeConfigService(nodeEnv: string) {
  return {
    get: vi.fn().mockReturnValue(nodeEnv),
  };
}

async function buildService(nodeEnv: string) {
  const module = await Test.createTestingModule({
    providers: [ArtifactService, { provide: ConfigService, useValue: makeConfigService(nodeEnv) }],
  }).compile();

  return module.get(ArtifactService);
}

describe('ArtifactService', () => {
  describe('handleArtifactUpload — non-production', () => {
    let service: ArtifactService;

    beforeEach(async () => {
      service = await buildService('test');
    });

    it('inserts an artifact record and returns runId', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'artifact.upload' as const,
        payload: {
          testId: TEST_ID,
          artifactType: 'screenshot' as const,
          name: 'failure.png',
          data: 'base64encodeddata',
        },
      };

      const result = await service.handleArtifactUpload(
        event,
        PROJECT_ID,
        mockTx as unknown as Database,
      );

      expect(result).toEqual({ runId: RUN_ID });
      expect(mockTx.insert).toHaveBeenCalledTimes(1);
    });

    it('stores a placeholder storagePath derived from runId, testId, and name', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'artifact.upload' as const,
        payload: {
          testId: TEST_ID,
          artifactType: 'screenshot' as const,
          name: 'failure.png',
          data: 'base64encodeddata',
        },
      };

      await service.handleArtifactUpload(event, PROJECT_ID, mockTx as unknown as Database);

      const valuesArg = mockTx.insert().values.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(valuesArg['storagePath']).toBe(`placeholder://${RUN_ID}/${TEST_ID}/failure.png`);
    });

    it('stores correct artifact type and name', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'artifact.upload' as const,
        payload: {
          testId: TEST_ID,
          artifactType: 'log' as const,
          name: 'output.log',
          data: 'log content',
        },
      };

      await service.handleArtifactUpload(event, PROJECT_ID, mockTx as unknown as Database);

      const valuesArg = mockTx.insert().values.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(valuesArg['type']).toBe('log');
      expect(valuesArg['name']).toBe('output.log');
      expect(valuesArg['testId']).toBe(TEST_ID);
    });

    it('sets mimeType to null when not provided', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'artifact.upload' as const,
        payload: {
          testId: TEST_ID,
          artifactType: 'screenshot' as const,
          name: 'capture.png',
          data: 'base64data',
        },
      };

      await service.handleArtifactUpload(event, PROJECT_ID, mockTx as unknown as Database);

      const valuesArg = mockTx.insert().values.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(valuesArg['mimeType']).toBeNull();
    });

    it('stores mimeType when provided', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'artifact.upload' as const,
        payload: {
          testId: TEST_ID,
          artifactType: 'screenshot' as const,
          name: 'capture.png',
          data: 'base64data',
          mimeType: 'image/png',
        },
      };

      await service.handleArtifactUpload(event, PROJECT_ID, mockTx as unknown as Database);

      const valuesArg = mockTx.insert().values.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(valuesArg['mimeType']).toBe('image/png');
    });

    it('throws NotFoundException when run belongs to a different project', async () => {
      const mockTx = makeMockTx('project-other' as ProjectId);

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'artifact.upload' as const,
        payload: {
          testId: TEST_ID,
          artifactType: 'screenshot' as const,
          name: 'failure.png',
          data: 'base64encodeddata',
        },
      };

      await expect(
        service.handleArtifactUpload(event, PROJECT_ID, mockTx as unknown as Database),
      ).rejects.toThrow(NotFoundException);

      expect(mockTx.insert).not.toHaveBeenCalled();
    });
  });

  describe('handleArtifactUpload — production guard', () => {
    it('throws NotImplementedException when NODE_ENV is production', async () => {
      const service = await buildService('production');
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'artifact.upload' as const,
        payload: {
          testId: TEST_ID,
          artifactType: 'screenshot' as const,
          name: 'failure.png',
          data: 'base64encodeddata',
        },
      };

      await expect(
        service.handleArtifactUpload(event, PROJECT_ID, mockTx as unknown as Database),
      ).rejects.toThrow(NotImplementedException);
    });

    it('does not insert when NODE_ENV is production', async () => {
      const service = await buildService('production');
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'artifact.upload' as const,
        payload: {
          testId: TEST_ID,
          artifactType: 'screenshot' as const,
          name: 'failure.png',
          data: 'base64encodeddata',
        },
      };

      await expect(
        service.handleArtifactUpload(event, PROJECT_ID, mockTx as unknown as Database),
      ).rejects.toThrow(NotImplementedException);

      expect(mockTx.insert).not.toHaveBeenCalled();
    });

    it('inserts normally when NODE_ENV is development', async () => {
      const service = await buildService('development');
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'artifact.upload' as const,
        payload: {
          testId: TEST_ID,
          artifactType: 'screenshot' as const,
          name: 'failure.png',
          data: 'base64encodeddata',
        },
      };

      await expect(
        service.handleArtifactUpload(event, PROJECT_ID, mockTx as unknown as Database),
      ).resolves.toEqual({ runId: RUN_ID });

      expect(mockTx.insert).toHaveBeenCalled();
    });
  });
});
