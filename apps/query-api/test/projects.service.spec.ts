import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { OrganizationId } from '@assertly/shared-types';
import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ProjectsService } from '../src/modules/projects/projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockOrderBy = vi.fn();
  const mockLimit = vi.fn();
  const mockOffset = vi.fn();
  const mockExecute = vi.fn();
  const mockInsert = vi.fn();
  const mockValues = vi.fn();
  const mockReturning = vi.fn();

  const mockTx = {
    execute: mockExecute,
    select: mockSelect,
    insert: mockInsert,
  };

  const mockDb = {
    transaction: vi.fn((callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Chain mocks for select().from().orderBy().limit().offset()
    mockOffset.mockResolvedValue([
      { id: 'proj-1', name: 'Alpha', createdAt: new Date('2024-01-01') },
    ]);
    mockLimit.mockReturnValue({ offset: mockOffset });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockFrom.mockReturnValue({ orderBy: mockOrderBy });
    mockSelect.mockReturnValue({ from: mockFrom });

    // Chain mocks for insert().values().returning()
    mockReturning.mockResolvedValue([
      {
        id: 'proj-new',
        name: 'New Project',
        organizationId: 'org-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockValues.mockReturnValue({ returning: mockReturning });
    mockInsert.mockReturnValue({ values: mockValues });

    const module = await Test.createTestingModule({
      providers: [ProjectsService, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    service = module.get(ProjectsService);
  });

  it('returns paginated projects with correct meta', async () => {
    // First select returns projects, second select returns count
    mockSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi
                .fn()
                .mockResolvedValue([
                  { id: 'proj-1', name: 'Alpha', createdAt: new Date('2024-01-01') },
                ]),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([{ count: 5 }]),
      });

    const result = await service.listProjects('org-1' as OrganizationId, {
      page: 1,
      pageSize: 20,
    });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(5);
    expect(result.meta.page).toBe(1);
    expect(result.meta.totalPages).toBe(1);
  });

  it('sets tenant context before querying', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });
    // Count query
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([{ count: 0 }]),
    });

    await service.listProjects('org-1' as OrganizationId, { page: 1, pageSize: 20 });

    // setTenantContext calls tx.execute
    expect(mockExecute).toHaveBeenCalled();
  });

  describe('createProject', () => {
    it('inserts with correct name and returns created row', async () => {
      const created = {
        id: 'proj-new',
        name: 'My Project',
        organizationId: 'org-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockReturning.mockResolvedValueOnce([created]);

      const result = await service.createProject('org-1' as OrganizationId, { name: 'My Project' });

      expect(result).toEqual(created);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
    });

    it('throws ConflictException on duplicate name (23505)', async () => {
      const pgError = Object.assign(new Error('duplicate key'), { code: '23505' });
      mockDb.transaction.mockRejectedValueOnce(pgError);

      await expect(
        service.createProject('org-1' as OrganizationId, { name: 'Duplicate' }),
      ).rejects.toThrow(ConflictException);
    });

    it('re-throws non-23505 errors', async () => {
      const genericError = new Error('connection lost');
      mockDb.transaction.mockRejectedValueOnce(genericError);

      await expect(
        service.createProject('org-1' as OrganizationId, { name: 'Test' }),
      ).rejects.toThrow('connection lost');
    });

    it('sets tenant context before insert', async () => {
      await service.createProject('org-1' as OrganizationId, { name: 'Context Test' });

      expect(mockExecute).toHaveBeenCalled();
    });
  });
});
