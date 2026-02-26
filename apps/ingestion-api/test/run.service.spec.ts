import type { Database } from '@assertly/database';
import type { OrganizationId, ProjectId, RunId } from '@assertly/shared-types';
import { RunStatus } from '@assertly/shared-types';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { RunService } from '../src/modules/ingestion/services/run.service';

const PROJECT_ID = 'project-1' as ProjectId;
const ORG_ID = '00000000-0000-4000-a000-000000000099' as OrganizationId;
const RUN_ID = '00000000-0000-4000-a000-000000000001' as RunId;
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
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };
}

describe('RunService', () => {
  let service: RunService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [RunService],
    }).compile();

    service = module.get(RunService);
  });

  describe('handleRunStart', () => {
    it('inserts a run record with correct fields and returns runId', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'run.start' as const,
        payload: {},
      };

      const result = await service.handleRunStart(
        event,
        PROJECT_ID,
        ORG_ID,
        mockTx as unknown as Database,
      );

      expect(result).toEqual({ runId: RUN_ID });
      expect(mockTx.insert).toHaveBeenCalledTimes(1);

      const valuesArg = mockTx.insert().values.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(valuesArg).toMatchObject({
        id: RUN_ID,
        projectId: PROJECT_ID,
        organizationId: ORG_ID,
        status: RunStatus.Pending,
      });
      expect(valuesArg['startedAt']).toBeInstanceOf(Date);
    });

    it('stores empty object as metadata when payload.metadata is absent', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'run.start' as const,
        payload: {},
      };

      await service.handleRunStart(event, PROJECT_ID, ORG_ID, mockTx as unknown as Database);

      const valuesArg = mockTx.insert().values.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(valuesArg['metadata']).toEqual({});
    });

    it('stores provided metadata when payload.metadata is present', async () => {
      const mockTx = makeMockTx();

      const metadata = { branch: 'main', commit: 'abc123' };
      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'run.start' as const,
        payload: { metadata },
      };

      await service.handleRunStart(event, PROJECT_ID, ORG_ID, mockTx as unknown as Database);

      const valuesArg = mockTx.insert().values.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(valuesArg['metadata']).toEqual(metadata);
    });

    it('converts the ISO timestamp string to a Date for startedAt', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'run.start' as const,
        payload: {},
      };

      await service.handleRunStart(event, PROJECT_ID, ORG_ID, mockTx as unknown as Database);

      const valuesArg = mockTx.insert().values.mock.calls[0]?.[0] as Record<string, unknown>;
      expect((valuesArg['startedAt'] as Date).toISOString()).toBe(TIMESTAMP);
    });
  });

  describe('handleRunEnd', () => {
    it('updates the run status and finishedAt, then returns runId', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'run.end' as const,
        payload: { status: 'passed' as const },
      };

      const result = await service.handleRunEnd(event, PROJECT_ID, mockTx as unknown as Database);

      expect(result).toEqual({ runId: RUN_ID });
      expect(mockTx.update).toHaveBeenCalledTimes(1);

      const setArg = mockTx.update().set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setArg).toMatchObject({ status: 'passed' });
      expect(setArg['finishedAt']).toBeInstanceOf(Date);
    });

    it('updates the run to failed status', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'run.end' as const,
        payload: { status: 'failed' as const },
      };

      await service.handleRunEnd(event, PROJECT_ID, mockTx as unknown as Database);

      const setArg = mockTx.update().set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setArg['status']).toBe('failed');
    });

    it('throws NotFoundException when the run belongs to a different project', async () => {
      const mockTx = makeMockTx('project-other' as ProjectId);

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'run.end' as const,
        payload: { status: 'passed' as const },
      };

      await expect(
        service.handleRunEnd(event, PROJECT_ID, mockTx as unknown as Database),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the run does not exist', async () => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'run.end' as const,
        payload: { status: 'passed' as const },
      };

      await expect(
        service.handleRunEnd(event, PROJECT_ID, mockTx as unknown as Database),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
