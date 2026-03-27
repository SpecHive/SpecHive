import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DATABASE_CONNECTION } from '@spechive/nestjs-common';
import type { OrganizationId, ProjectId, RunId } from '@spechive/shared-types';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { RunsService } from '../src/modules/runs/runs.service';

describe('RunsService', () => {
  let service: RunsService;
  const mockExecute = vi.fn();
  const mockSelect = vi.fn();

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
      providers: [RunsService, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    service = module.get(RunsService);
  });

  describe('listRuns', () => {
    it('returns paginated runs', async () => {
      const mockRun = {
        id: 'run-1',
        projectId: 'proj-1',
        name: 'Nightly E2E',
        status: 'passed',
        totalTests: 10,
        passedTests: 8,
        failedTests: 1,
        skippedTests: 1,
        startedAt: new Date(),
        finishedAt: new Date(),
        createdAt: new Date(),
      };

      mockSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([mockRun]),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        });

      const result = await service.listRuns('org-1' as OrganizationId, ['proj-1' as ProjectId], {
        page: 1,
        pageSize: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.status).toBe('passed');
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getRunById', () => {
    it('throws 404 when run not found', async () => {
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      await expect(
        service.getRunById('org-1' as OrganizationId, 'non-existent' as RunId),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns run detail with suite count', async () => {
      const mockRun = {
        id: 'run-1',
        projectId: 'proj-1',
        name: null,
        status: 'passed',
        totalTests: 10,
        passedTests: 8,
        failedTests: 1,
        skippedTests: 1,
        startedAt: new Date(),
        finishedAt: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRun]),
          }),
        }),
      });

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      });

      const result = await service.getRunById('org-1' as OrganizationId, 'run-1' as RunId);

      expect(result.id).toBe('run-1');
      expect(result.suiteCount).toBe(3);
    });
  });
});
