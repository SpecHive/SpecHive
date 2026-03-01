import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { OrganizationId, RunId } from '@assertly/shared-types';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SuitesService } from '../src/modules/suites/suites.service';

describe('SuitesService', () => {
  let service: SuitesService;
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
      providers: [SuitesService, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    service = module.get(SuitesService);
  });

  describe('listSuitesByRunId', () => {
    it('returns empty array when run has no suites', async () => {
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.listSuitesByRunId('org-1' as OrganizationId, 'run-1' as RunId);

      expect(result.data).toHaveLength(0);
    });

    it('returns suite hierarchy ordered by createdAt', async () => {
      const parentSuite = {
        id: 'suite-1',
        name: 'Auth Tests',
        parentSuiteId: null,
        createdAt: new Date('2026-01-01'),
      };
      const childSuite = {
        id: 'suite-2',
        name: 'Login Tests',
        parentSuiteId: 'suite-1',
        createdAt: new Date('2026-01-02'),
      };

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([parentSuite, childSuite]),
          }),
        }),
      });

      const result = await service.listSuitesByRunId('org-1' as OrganizationId, 'run-1' as RunId);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]!.name).toBe('Auth Tests');
      expect(result.data[0]!.parentSuiteId).toBeNull();
      expect(result.data[1]!.name).toBe('Login Tests');
      expect(result.data[1]!.parentSuiteId).toBe('suite-1');
    });

    it('sets tenant context within the transaction', async () => {
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await service.listSuitesByRunId('org-1' as OrganizationId, 'run-1' as RunId);

      expect(mockExecute).toHaveBeenCalled();
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });
});
