import { HealthCheckError, type HealthCheckService } from '@nestjs/terminus';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { HealthController } from '../src/health/health.controller';
import type { DbHealthIndicator } from '../src/health/indicators/db-health.indicator';
import type { S3HealthIndicator } from '../src/health/indicators/s3-health.indicator';

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealthCheckService: HealthCheckService;
  let mockDbHealth: DbHealthIndicator;
  let mockS3Health: S3HealthIndicator;

  beforeEach(() => {
    mockHealthCheckService = {
      check: vi.fn().mockImplementation(async (indicators: (() => Promise<unknown>)[]) => {
        const results = await Promise.all(indicators.map((fn) => fn()));
        return { status: 'ok', info: Object.assign({}, ...results) };
      }),
    } as unknown as HealthCheckService;

    mockDbHealth = {
      isAvailable: vi.fn().mockReturnValue(true),
      isHealthy: vi.fn().mockResolvedValue({ database: { status: 'up', responseTimeMs: 1 } }),
    } as unknown as DbHealthIndicator;

    mockS3Health = {
      isAvailable: vi.fn().mockReturnValue(true),
      isHealthy: vi.fn().mockResolvedValue({ storage: { status: 'up', responseTimeMs: 2 } }),
    } as unknown as S3HealthIndicator;

    controller = new HealthController(mockHealthCheckService, mockDbHealth, mockS3Health);
  });

  describe('GET /health (liveness)', () => {
    it('returns status ok with a valid ISO timestamp', () => {
      const result = controller.check();

      expect(result.status).toBe('ok');
      expect(typeof result.timestamp).toBe('string');
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });

  describe('GET /health/ready (readiness)', () => {
    it('returns 200 when all indicators pass', async () => {
      const result = await controller.ready();

      expect(result.status).toBe('ok');
      expect(mockDbHealth.isHealthy).toHaveBeenCalledWith('database');
      expect(mockS3Health.isHealthy).toHaveBeenCalledWith('storage');
    });

    it('includes S3 check only when available', async () => {
      (mockS3Health.isAvailable as ReturnType<typeof vi.fn>).mockReturnValue(false);

      await controller.ready();

      expect(mockDbHealth.isHealthy).toHaveBeenCalledWith('database');
      expect(mockS3Health.isHealthy).not.toHaveBeenCalled();
    });

    it('propagates error when DB indicator fails', async () => {
      const dbError = new HealthCheckError('DB failed', { database: { status: 'down' } });
      (mockDbHealth.isHealthy as ReturnType<typeof vi.fn>).mockRejectedValue(dbError);
      (mockHealthCheckService.check as ReturnType<typeof vi.fn>).mockRejectedValue(dbError);

      await expect(controller.ready()).rejects.toThrow(HealthCheckError);
    });
  });
});
