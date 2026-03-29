import { Test } from '@nestjs/testing';
import { REDIS_CLIENT } from '@spechive/nestjs-common/redis';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createMockPinoLogger } from '../../../test/unit-helpers/mock-logger';
import { LoginRateLimitService } from '../src/modules/auth/login-rate-limit.service';

const mockPipeline = {
  incr: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
};

const mockRedis = {
  get: vi.fn(),
  del: vi.fn(),
  pipeline: vi.fn(() => mockPipeline),
  quit: vi.fn().mockResolvedValue('OK'),
};

describe('LoginRateLimitService', () => {
  let service: LoginRateLimitService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        LoginRateLimitService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
        createMockPinoLogger('LoginRateLimitService'),
      ],
    }).compile();

    service = module.get(LoginRateLimitService);
  });

  describe('isBlocked', () => {
    it('returns false when key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);
      expect(await service.isBlocked('user@example.com')).toBe(false);
    });

    it('returns false when count is below threshold', async () => {
      mockRedis.get.mockResolvedValue('3');
      expect(await service.isBlocked('user@example.com')).toBe(false);
    });

    it('returns true when count equals threshold', async () => {
      mockRedis.get.mockResolvedValue('5');
      expect(await service.isBlocked('user@example.com')).toBe(true);
    });

    it('returns true when count exceeds threshold', async () => {
      mockRedis.get.mockResolvedValue('10');
      expect(await service.isBlocked('user@example.com')).toBe(true);
    });

    it('fails open when Redis returns non-numeric value', async () => {
      mockRedis.get.mockResolvedValue('not-a-number');
      expect(await service.isBlocked('user@example.com')).toBe(false);
    });

    it('fails open when Redis throws', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection refused'));
      expect(await service.isBlocked('user@example.com')).toBe(false);
    });
  });

  describe('recordFailure', () => {
    it('uses pipeline for atomic incr + expire', async () => {
      await service.recordFailure('user@example.com');

      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockPipeline.incr).toHaveBeenCalledWith('login:ratelimit:user@example.com');
      expect(mockPipeline.expire).toHaveBeenCalledWith(
        'login:ratelimit:user@example.com',
        900,
        'NX',
      );
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('does not throw when Redis is unavailable', async () => {
      mockPipeline.exec.mockRejectedValue(new Error('Connection refused'));
      await expect(service.recordFailure('user@example.com')).resolves.toBeUndefined();
    });
  });

  describe('recordSuccess', () => {
    it('deletes the rate-limit key', async () => {
      mockRedis.del.mockResolvedValue(1);
      await service.recordSuccess('user@example.com');
      expect(mockRedis.del).toHaveBeenCalledWith('login:ratelimit:user@example.com');
    });

    it('does not throw when Redis is unavailable', async () => {
      mockRedis.del.mockRejectedValue(new Error('Connection refused'));
      await expect(service.recordSuccess('user@example.com')).resolves.toBeUndefined();
    });
  });

  describe('key normalization', () => {
    it('lowercases email in the key', async () => {
      mockRedis.get.mockResolvedValue(null);
      await service.isBlocked('User@Example.COM');
      expect(mockRedis.get).toHaveBeenCalledWith('login:ratelimit:user@example.com');
    });
  });
});
