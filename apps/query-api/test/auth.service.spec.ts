import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DATABASE_CONNECTION } from '@spechive/nestjs-common';
import type { OrganizationId, UserId } from '@spechive/shared-types';
import { verify } from 'argon2';
import { jwtVerify } from 'jose';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AuthService } from '../src/modules/auth/auth.service';

vi.mock('argon2', () => ({
  verify: vi.fn(),
  hash: vi.fn().mockResolvedValue('$argon2id$mocked-hash'),
}));

vi.mock('uuidv7', () => ({
  uuidv7: vi.fn().mockReturnValue('00000000-0000-7000-8000-000000000099'),
}));

vi.mock('@spechive/database', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, setTenantContext: vi.fn() };
});

const mockVerify = vi.mocked(verify);

const JWT_SECRET = 'test-secret-for-unit-tests-only-not-for-production-use';
const secret = new TextEncoder().encode(JWT_SECRET);

const MOCK_USER = {
  id: '00000000-0000-4000-a000-000000000001',
  email: 'test@spechive.dev',
  password_hash: '$argon2id$hash',
  name: 'Test User',
};

const MOCK_ORG = {
  organization_id: '00000000-0000-4000-a000-000000000099',
  organization_name: 'Test Org',
  organization_slug: 'test-org',
  role: 'owner',
};

describe('AuthService', () => {
  let service: AuthService;
  const mockExecute = vi.fn();
  const mockTransaction = vi.fn(
    async (fn: (tx: { execute: typeof mockExecute }) => Promise<unknown>) => {
      return fn({ execute: mockExecute });
    },
  );

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DATABASE_CONNECTION,
          useValue: { execute: mockExecute, transaction: mockTransaction },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
              if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
              return undefined;
            }),
            getOrThrow: vi.fn((key: string) => {
              if (key === 'JWT_SECRET') return JWT_SECRET;
              if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
              return '';
            }),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('login', () => {
    it('returns token and user info on successful login', async () => {
      mockExecute
        .mockResolvedValueOnce([MOCK_USER])
        .mockResolvedValueOnce([MOCK_ORG])
        .mockResolvedValueOnce([]); // store_refresh_token
      mockVerify.mockResolvedValue(true);

      const result = await service.login('test@spechive.dev', 'password123');

      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('test@spechive.dev');
      expect(result.organization.id).toBe(MOCK_ORG.organization_id);

      // Verify the JWT contains the correct payload
      const { payload } = await jwtVerify(result.token, secret);
      expect(payload.sub).toBe(MOCK_USER.id);
      expect(payload.organizationId).toBe(MOCK_ORG.organization_id);
      expect(payload.role).toBe('owner');
    });

    it('throws 401 when user is not found', async () => {
      mockExecute.mockResolvedValueOnce([]);

      await expect(service.login('unknown@test.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws 401 when password is wrong', async () => {
      mockExecute.mockResolvedValueOnce([MOCK_USER]);
      mockVerify.mockResolvedValue(false);

      await expect(service.login('test@spechive.dev', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws 403 when user has no organization memberships', async () => {
      mockExecute.mockResolvedValueOnce([MOCK_USER]).mockResolvedValueOnce([]);
      mockVerify.mockResolvedValue(true);

      await expect(service.login('test@spechive.dev', 'password123')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws 403 when requested organization is not found in memberships', async () => {
      mockExecute.mockResolvedValueOnce([MOCK_USER]).mockResolvedValueOnce([MOCK_ORG]);
      mockVerify.mockResolvedValue(true);

      await expect(
        service.login('test@spechive.dev', 'password123', 'non-existent-org-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('uses the requested organizationId when provided', async () => {
      const secondOrg = { ...MOCK_ORG, organization_id: 'org-2', organization_name: 'Org 2' };
      mockExecute
        .mockResolvedValueOnce([MOCK_USER])
        .mockResolvedValueOnce([MOCK_ORG, secondOrg])
        .mockResolvedValueOnce([]); // store_refresh_token
      mockVerify.mockResolvedValue(true);

      const result = await service.login('test@spechive.dev', 'password123', 'org-2');

      expect(result.organization.id).toBe('org-2');
    });
  });

  describe('getProfile', () => {
    it('returns user profile', async () => {
      mockExecute.mockResolvedValueOnce([
        { id: MOCK_USER.id, email: MOCK_USER.email, name: MOCK_USER.name },
      ]);

      const result = await service.getProfile(
        MOCK_USER.id as UserId,
        MOCK_ORG.organization_id as OrganizationId,
      );
      expect(result.email).toBe('test@spechive.dev');
    });

    it('throws 401 when user not found', async () => {
      mockExecute.mockResolvedValueOnce([]);

      await expect(
        service.getProfile('non-existent' as UserId, MOCK_ORG.organization_id as OrganizationId),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getOrganizations', () => {
    it('returns user organizations', async () => {
      mockExecute.mockResolvedValueOnce([MOCK_ORG]);

      const result = await service.getOrganizations(MOCK_USER.id as UserId);
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(MOCK_ORG.organization_id);
      expect(result[0]!.role).toBe('owner');
    });
  });

  describe('register', () => {
    it('returns token, user, and organization on success', async () => {
      // register_user SQL call + store_refresh_token
      mockExecute
        .mockResolvedValueOnce([]) // register_user
        .mockResolvedValueOnce([]); // store_refresh_token

      const result = await service.register('new@test.com', 'password123', 'New User', 'New Org');

      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('new@test.com');
      expect(result.user.name).toBe('New User');
      expect(result.organization.name).toBe('New Org');
      expect(result.organization.slug).toBe('new-org');

      const { payload } = await jwtVerify(result.token, secret);
      expect(payload.role).toBe('owner');
    });

    it('throws ConflictException on duplicate email', async () => {
      const dbError = Object.assign(new Error('unique violation'), {
        code: '23505',
        detail: 'Key (email)=(test@test.com) already exists.',
      });
      mockExecute.mockRejectedValueOnce(dbError);

      await expect(service.register('test@test.com', 'password123', 'Test', 'Org')).rejects.toThrow(
        ConflictException,
      );
    });

    it('retries with slug suffix on slug collision', async () => {
      const dbError = Object.assign(new Error('unique violation'), {
        code: '23505',
        detail: 'Key (slug)=(test-org) already exists.',
      });
      mockExecute
        .mockRejectedValueOnce(dbError) // first attempt fails on slug
        .mockResolvedValueOnce([]) // retry succeeds
        .mockResolvedValueOnce([]); // store_refresh_token

      const result = await service.register('new2@test.com', 'password123', 'New User', 'Test Org');

      expect(result.token).toBeDefined();
      // Slug should have random suffix
      expect(result.organization.slug).toMatch(/^test-org-[0-9a-f]{4}$/);
    });

    it('throws ConflictException on email conflict during slug retry', async () => {
      const slugError = Object.assign(new Error('unique violation'), {
        code: '23505',
        detail: 'Key (slug)=(test-org) already exists.',
      });
      const emailError = Object.assign(new Error('unique violation'), {
        code: '23505',
        detail: 'Key (email)=(new@test.com) already exists.',
      });
      mockExecute
        .mockRejectedValueOnce(slugError) // first attempt fails on slug
        .mockRejectedValueOnce(emailError); // retry fails on email

      await expect(
        service.register('new@test.com', 'password123', 'Test', 'Test Org'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException after max slug retries exhausted', async () => {
      const slugError = Object.assign(new Error('unique violation'), {
        code: '23505',
        detail: 'Key (slug)=(test-org) already exists.',
      });
      mockExecute
        .mockRejectedValueOnce(slugError)
        .mockRejectedValueOnce(slugError)
        .mockRejectedValueOnce(slugError);

      await expect(
        service.register('new@test.com', 'password123', 'Test', 'Test Org'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
