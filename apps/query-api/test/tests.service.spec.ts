import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DATABASE_CONNECTION } from '@spechive/nestjs-common';
import type { OrganizationId, RunId, TestId } from '@spechive/shared-types';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { TestsService } from '../src/modules/tests/tests.service';

describe('TestsService', () => {
  let service: TestsService;
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
      providers: [TestsService, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    service = module.get(TestsService);
  });

  describe('listTests', () => {
    it('returns paginated tests', async () => {
      const mockTest = {
        id: 'test-1',
        suiteId: 'suite-1',
        runId: 'run-1',
        name: 'should pass',
        status: 'passed',
        durationMs: 150,
        errorMessage: null,
        retryCount: 0,
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
                  offset: vi.fn().mockResolvedValue([mockTest]),
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

      const result = await service.listTests('org-1' as OrganizationId, 'run-1' as RunId, {
        page: 1,
        pageSize: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.name).toBe('should pass');
    });
  });

  describe('getTestById', () => {
    it('throws 404 when test not found', async () => {
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        service.getTestById('org-1' as OrganizationId, 'run-1' as RunId, 'non-existent' as TestId),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns test detail with artifacts', async () => {
      const mockTest = {
        id: 'test-1',
        suiteId: 'suite-1',
        runId: 'run-1',
        organizationId: 'org-1',
        name: 'should fail',
        status: 'failed',
        durationMs: 300,
        errorMessage: 'Expected true to be false',
        stackTrace: 'Error: ...',
        retryCount: 0,
        startedAt: new Date(),
        finishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTest]),
          }),
        }),
      });

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'art-1',
              type: 'screenshot',
              name: 'failure.png',
              sizeBytes: 1024,
              mimeType: 'image/png',
              retryIndex: null,
              createdAt: new Date(),
            },
          ]),
        }),
      });

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              {
                retryIndex: 0,
                status: 'failed',
                durationMs: 300,
                errorMessage: 'Expected true to be false',
                stackTrace: 'Error: ...',
              },
            ]),
          }),
        }),
      });

      const result = await service.getTestById(
        'org-1' as OrganizationId,
        'run-1' as RunId,
        'test-1' as TestId,
      );

      expect(result.name).toBe('should fail');
      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0]!.name).toBe('failure.png');
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0]!.retryIndex).toBe(0);
    });
  });
});
