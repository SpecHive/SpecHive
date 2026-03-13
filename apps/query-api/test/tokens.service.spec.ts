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

    // Default chain: select().from().where()
    mockWhere.mockResolvedValue([{ id: PROJECT_ID }]);
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    // Default chain: insert().values().returning()
    mockReturning.mockResolvedValue([
      { id: 'tok-1', name: 'CI Token', tokenPrefix: 'at_abcdef1234567', createdAt: new Date() },
    ]);
    mockValues.mockReturnValue({ returning: mockReturning });
    mockInsert.mockReturnValue({ values: mockValues });

    // Default chain: update().set().where().returning()
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
      };

      // First select: project check
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: PROJECT_ID }]) }),
      });
      // Second select: token rows
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([tokenRow]),
              }),
            }),
          }),
        }),
      });
      // Third select: count
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      const result = await service.listTokens(ORG_ID, PROJECT_ID, { page: 1, pageSize: 20 }, false);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('tokenHash');
      expect(result.data[0]!.name).toBe('CI Token');
      expect(result.meta.total).toBe(1);
    });

    it('throws NotFoundException if project not found', async () => {
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      });

      await expect(
        service.listTokens(ORG_ID, PROJECT_ID, { page: 1, pageSize: 20 }, false),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('revokeToken', () => {
    it('sets revokedAt and returns void on success', async () => {
      const mockWhereChain = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'tok-1' }]),
      });
      mockSet.mockReturnValue({ where: mockWhereChain });

      await expect(
        service.revokeToken(ORG_ID, PROJECT_ID, 'tok-1' as ProjectTokenId),
      ).resolves.toBeUndefined();
    });

    it('throws NotFoundException if token not found or already revoked', async () => {
      const mockWhereChain = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      });
      mockSet.mockReturnValue({ where: mockWhereChain });

      await expect(
        service.revokeToken(ORG_ID, PROJECT_ID, 'tok-nonexistent' as ProjectTokenId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
