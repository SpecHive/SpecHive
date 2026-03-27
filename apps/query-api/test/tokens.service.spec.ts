import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DATABASE_CONNECTION } from '@spechive/nestjs-common';
import type { OrganizationId, ProjectId, ProjectTokenId } from '@spechive/shared-types';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { TokensService } from '../src/modules/tokens/tokens.service';

describe('TokensService', () => {
  let service: TokensService;
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockWhere = vi.fn();
  const mockExecute = vi.fn();
  const mockInsert = vi.fn();
  const mockValues = vi.fn();
  const mockReturning = vi.fn();
  const mockUpdate = vi.fn();
  const mockSet = vi.fn();

  const ORG_ID = 'org-1' as OrganizationId;
  const PROJECT_ID = 'proj-1' as ProjectId;

  const mockTx = {
    execute: mockExecute,
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  };

  const mockDb = {
    transaction: vi.fn((callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockWhere.mockResolvedValue([{ id: PROJECT_ID }]);
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    mockReturning.mockResolvedValue([
      { id: 'tok-1', name: 'CI Token', tokenPrefix: 'at_abcdef1234567', createdAt: new Date() },
    ]);
    mockValues.mockReturnValue({ returning: mockReturning });
    mockInsert.mockReturnValue({ values: mockValues });

    mockSet.mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'tok-1' }]) }),
    });
    mockUpdate.mockReturnValue({ set: mockSet });

    const module = await Test.createTestingModule({
      providers: [TokensService, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    service = module.get(TokensService);
  });

  describe('createToken', () => {
    it('generates token with at_ prefix and correct length', async () => {
      const result = await service.createToken(ORG_ID, PROJECT_ID, { name: 'CI Token' });

      expect(result.token).toMatch(/^at_[0-9a-f]{64}$/);
      expect(result.token.length).toBe(67);
      expect(result.name).toBe('CI Token');
      expect(result.id).toBe('tok-1');
    });

    it('throws NotFoundException if project not found', async () => {
      mockWhere.mockResolvedValueOnce([]);

      await expect(service.createToken(ORG_ID, PROJECT_ID, { name: 'Token' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('sets tenant context before operations', async () => {
      await service.createToken(ORG_ID, PROJECT_ID, { name: 'Token' });

      expect(mockExecute).toHaveBeenCalled();
    });

    it('inserts token hash into database', async () => {
      await service.createToken(ORG_ID, PROJECT_ID, { name: 'My Token' });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalled();
    });
  });

  describe('listTokens', () => {
    it('returns paginated tokens excluding tokenHash', async () => {
      const tokenRow = {
        id: 'tok-1',
        name: 'CI Token',
        tokenPrefix: 'at_abc',
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
        projectId: PROJECT_ID,
        projectName: 'My Project',
      };

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([tokenRow]),
                }),
              }),
            }),
          }),
        }),
      });
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        }),
      });

      const result = await service.listTokens(
        ORG_ID,
        [PROJECT_ID],
        { page: 1, pageSize: 20 },
        false,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('tokenHash');
      expect(result.data[0]!.name).toBe('CI Token');
      expect(result.meta.total).toBe(1);
    });

    it('lists tokens across all projects when projectIds is absent', async () => {
      const tokenRow = {
        id: 'tok-2',
        name: 'Global Token',
        tokenPrefix: 'at_xyz',
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
        projectId: PROJECT_ID,
        projectName: 'My Project',
      };

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([tokenRow]),
                }),
              }),
            }),
          }),
        }),
      });
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        }),
      });

      const result = await service.listTokens(ORG_ID, undefined, { page: 1, pageSize: 20 }, false);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.projectName).toBe('My Project');
    });

    it('returns empty list when filtering by non-existent project', async () => {
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      });
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        }),
      });

      const result = await service.listTokens(
        ORG_ID,
        [PROJECT_ID],
        { page: 1, pageSize: 20 },
        false,
      );
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('revokeToken', () => {
    it('sets revokedAt and returns void on success', async () => {
      const mockWhereChain = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'tok-1' }]),
      });
      mockSet.mockReturnValue({ where: mockWhereChain });

      await expect(service.revokeToken(ORG_ID, 'tok-1' as ProjectTokenId)).resolves.toBeUndefined();
    });

    it('throws NotFoundException if token not found or already revoked', async () => {
      const mockWhereChain = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      });
      mockSet.mockReturnValue({ where: mockWhereChain });

      await expect(
        service.revokeToken(ORG_ID, 'tok-nonexistent' as ProjectTokenId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
