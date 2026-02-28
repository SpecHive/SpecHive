import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { OrganizationId } from '@assertly/shared-types';
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

  const mockTx = {
    execute: mockExecute,
    select: mockSelect,
  };

  const mockDb = {
    transaction: vi.fn((callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Chain mocks for select().from().orderBy().limit().offset()
    mockOffset.mockResolvedValue([
      { id: 'proj-1', name: 'Alpha', slug: 'alpha', createdAt: new Date('2024-01-01') },
    ]);
    mockLimit.mockReturnValue({ offset: mockOffset });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockFrom.mockReturnValue({ orderBy: mockOrderBy });
    mockSelect.mockReturnValue({ from: mockFrom });

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
                  { id: 'proj-1', name: 'Alpha', slug: 'alpha', createdAt: new Date('2024-01-01') },
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
});
