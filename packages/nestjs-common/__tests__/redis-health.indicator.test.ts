import { HealthCheckError } from '@nestjs/terminus';
import type Redis from 'ioredis';
import type { PinoLogger } from 'nestjs-pino';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { RedisHealthIndicator } from '../src/health/indicators/redis-health.indicator';
import type { MetricsService } from '../src/metrics/metrics.service';

const mockGauge = { set: vi.fn() };

function createMockMetrics(enabled = true): MetricsService {
  return {
    enabled,
    createGauge: vi.fn().mockReturnValue(mockGauge),
  } as unknown as MetricsService;
}

function createMockLogger() {
  return { warn: vi.fn(), info: vi.fn() };
}

function asLogger(m: ReturnType<typeof createMockLogger>): PinoLogger {
  return m as unknown as PinoLogger;
}

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let mockRedis: { ping: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = { ping: vi.fn().mockResolvedValue('PONG') };
    indicator = new RedisHealthIndicator(
      asLogger(createMockLogger()),
      mockRedis as unknown as Redis,
      createMockMetrics(),
    );
  });

  it('returns healthy with responseTimeMs on successful ping', async () => {
    const result = await indicator.isHealthy('redis');

    expect(result.redis.status).toBe('up');
    expect(result.redis.responseTimeMs).toBeTypeOf('number');
    expect(mockRedis.ping).toHaveBeenCalledTimes(1);
  });

  it('isAvailable returns false when Redis not injected', () => {
    const noRedisIndicator = new RedisHealthIndicator(
      asLogger(createMockLogger()),
      undefined,
      createMockMetrics(),
    );
    expect(noRedisIndicator.isAvailable()).toBe(false);
  });

  it('throws HealthCheckError on connection error', async () => {
    mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

    await expect(indicator.isHealthy('redis')).rejects.toThrow(HealthCheckError);
  });

  it('includes error message in unhealthy status', async () => {
    mockRedis.ping.mockRejectedValue(new Error('ECONNREFUSED'));

    try {
      await indicator.isHealthy('redis');
    } catch (error) {
      expect(error).toBeInstanceOf(HealthCheckError);
      const causes = (error as HealthCheckError).causes;
      expect(causes.redis.status).toBe('down');
      expect(causes.redis.message).toBe('ECONNREFUSED');
    }
  });

  it('does not mutate the Prometheus gauge from isHealthy (periodic poll is authoritative)', async () => {
    await indicator.isHealthy('redis');

    expect(mockGauge.set).not.toHaveBeenCalled();
  });

  it('does not mutate the gauge on failed ping in isHealthy', async () => {
    mockRedis.ping.mockRejectedValue(new Error('connection lost'));

    await expect(indicator.isHealthy('redis')).rejects.toThrow();

    expect(mockGauge.set).not.toHaveBeenCalled();
  });

  it('does not create gauge when Redis is not injected', () => {
    const metrics = createMockMetrics();
    new RedisHealthIndicator(asLogger(createMockLogger()), undefined, metrics);

    expect(metrics.createGauge).not.toHaveBeenCalled();
  });

  it('does not create gauge when metrics.enabled is false', () => {
    const metrics = createMockMetrics(false);
    new RedisHealthIndicator(asLogger(createMockLogger()), mockRedis as unknown as Redis, metrics);

    expect(metrics.createGauge).not.toHaveBeenCalled();
  });

  it('does not set gauge at construction (no optimistic init)', () => {
    vi.clearAllMocks();
    new RedisHealthIndicator(
      asLogger(createMockLogger()),
      mockRedis as unknown as Redis,
      createMockMetrics(),
    );

    expect(mockGauge.set).not.toHaveBeenCalled();
  });

  describe('periodic poll', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('pings Redis on onModuleInit and sets gauge to 1 on success', async () => {
      indicator.onModuleInit();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockRedis.ping).toHaveBeenCalled();
      expect(mockGauge.set).toHaveBeenCalledWith(1);
    });

    it('sets gauge to 0 when periodic ping fails (no /health/ready traffic needed)', async () => {
      mockRedis.ping.mockRejectedValue(new Error('connection refused'));

      indicator.onModuleInit();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockGauge.set).toHaveBeenCalledWith(0);
    });

    it('pings periodically after init', async () => {
      indicator.onModuleInit();
      await vi.advanceTimersByTimeAsync(0);
      const initialCalls = mockRedis.ping.mock.calls.length;

      await vi.advanceTimersByTimeAsync(15_000);
      expect(mockRedis.ping.mock.calls.length).toBeGreaterThan(initialCalls);
    });

    it('stops polling on onModuleDestroy', async () => {
      indicator.onModuleInit();
      await vi.advanceTimersByTimeAsync(0);
      indicator.onModuleDestroy();

      mockRedis.ping.mockClear();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(mockRedis.ping).not.toHaveBeenCalled();
    });

    it('does not schedule polling when Redis is not injected', () => {
      const noRedis = new RedisHealthIndicator(
        asLogger(createMockLogger()),
        undefined,
        createMockMetrics(),
      );
      noRedis.onModuleInit();

      // If it had scheduled a timer, advancing time would fire it
      expect(() => noRedis.onModuleDestroy()).not.toThrow();
    });

    it('does not schedule polling when metrics.enabled is false', async () => {
      const disabled = new RedisHealthIndicator(
        asLogger(createMockLogger()),
        mockRedis as unknown as Redis,
        createMockMetrics(false),
      );
      disabled.onModuleInit();

      await vi.advanceTimersByTimeAsync(30_000);
      expect(mockRedis.ping).not.toHaveBeenCalled();
    });

    it('logs on first ping failure and dedupes across repeated failures', async () => {
      const logger = createMockLogger();
      mockRedis.ping.mockRejectedValue(new Error('connection refused'));
      const dedupIndicator = new RedisHealthIndicator(
        asLogger(logger),
        mockRedis as unknown as Redis,
        createMockMetrics(),
      );

      dedupIndicator.onModuleInit();
      await vi.advanceTimersByTimeAsync(0);
      expect(logger.warn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(15_000);
      expect(logger.warn).toHaveBeenCalledTimes(1); // deduped — still 1
    });

    it('logs on recovery after failure, once', async () => {
      const logger = createMockLogger();
      mockRedis.ping
        .mockRejectedValueOnce(new Error('first'))
        .mockResolvedValueOnce('PONG')
        .mockResolvedValueOnce('PONG');
      const dedupIndicator = new RedisHealthIndicator(
        asLogger(logger),
        mockRedis as unknown as Redis,
        createMockMetrics(),
      );

      dedupIndicator.onModuleInit();
      await vi.advanceTimersByTimeAsync(0);
      expect(logger.warn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(15_000);
      expect(logger.info).toHaveBeenCalledWith('redis background ping recovered');
      expect(logger.info).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(15_000);
      expect(logger.info).toHaveBeenCalledTimes(1); // stay healthy — no extra log
    });
  });
});
