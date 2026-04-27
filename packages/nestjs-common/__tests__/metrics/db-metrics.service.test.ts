import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { DbMetricsService } from '../../src/metrics/db-metrics.service';
import type { MetricsService } from '../../src/metrics/metrics.service';

const mockGauge = { set: vi.fn() };

function createMockMetrics(enabled = true): MetricsService {
  return {
    enabled,
    createGauge: vi.fn().mockReturnValue(mockGauge),
  } as unknown as MetricsService;
}

function createMockDb(count = 5) {
  return { execute: vi.fn().mockResolvedValue([{ count }]) };
}

function createMockConfig(serviceName: string | undefined): ConfigService {
  return {
    get: vi.fn((key: string) => {
      if (key === 'SERVICE_NAME') return serviceName;
      return undefined;
    }),
  } as unknown as ConfigService;
}

function createMockLogger() {
  return { warn: vi.fn(), info: vi.fn() };
}

function asLogger(m: ReturnType<typeof createMockLogger>): PinoLogger {
  return m as unknown as PinoLogger;
}

describe('DbMetricsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates gauge when db, metrics, and SERVICE_NAME are all available', () => {
    const metrics = createMockMetrics();
    new DbMetricsService(
      asLogger(createMockLogger()),
      metrics,
      createMockDb(),
      createMockConfig('worker'),
    );

    expect(metrics.createGauge).toHaveBeenCalledWith(
      'spechive_db_active_connections',
      expect.any(String),
      [],
    );
  });

  it('does not create gauge when db is undefined', () => {
    const metrics = createMockMetrics();
    new DbMetricsService(
      asLogger(createMockLogger()),
      metrics,
      undefined,
      createMockConfig('worker'),
    );

    expect(metrics.createGauge).not.toHaveBeenCalled();
  });

  it('does not create gauge when SERVICE_NAME is undefined', () => {
    const metrics = createMockMetrics();
    new DbMetricsService(
      asLogger(createMockLogger()),
      metrics,
      createMockDb(),
      createMockConfig(undefined),
    );

    expect(metrics.createGauge).not.toHaveBeenCalled();
  });

  it('does not create gauge when metrics.enabled is false (no DB polling)', () => {
    const metrics = createMockMetrics(false);
    const db = createMockDb();
    const service = new DbMetricsService(
      asLogger(createMockLogger()),
      metrics,
      db,
      createMockConfig('worker'),
    );

    expect(metrics.createGauge).not.toHaveBeenCalled();
    service.onModuleInit();
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('polls on init and sets gauge value', async () => {
    const db = createMockDb(8);
    const service = new DbMetricsService(
      asLogger(createMockLogger()),
      createMockMetrics(),
      db,
      createMockConfig('worker'),
    );

    service.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);

    expect(db.execute).toHaveBeenCalledOnce();
    expect(mockGauge.set).toHaveBeenCalledWith(8);
  });

  it('polls periodically after init', async () => {
    const db = createMockDb(3);
    const service = new DbMetricsService(
      asLogger(createMockLogger()),
      createMockMetrics(),
      db,
      createMockConfig('worker'),
    );

    service.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    expect(db.execute).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it('clears interval on destroy', async () => {
    const db = createMockDb();
    const service = new DbMetricsService(
      asLogger(createMockLogger()),
      createMockMetrics(),
      db,
      createMockConfig('worker'),
    );

    service.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    service.onModuleDestroy();

    db.execute.mockClear();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('does not start polling when db is missing', () => {
    const service = new DbMetricsService(
      asLogger(createMockLogger()),
      createMockMetrics(),
      undefined,
      createMockConfig('worker'),
    );
    service.onModuleInit();

    expect(mockGauge.set).not.toHaveBeenCalled();
  });

  it('does not throw on poll failure', async () => {
    const db = createMockDb();
    db.execute.mockRejectedValueOnce(new Error('connection lost'));
    const service = new DbMetricsService(
      asLogger(createMockLogger()),
      createMockMetrics(),
      db,
      createMockConfig('worker'),
    );

    service.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);

    expect(mockGauge.set).not.toHaveBeenCalled();
  });

  it('logs on first poll failure and on recovery, deduped across failures', async () => {
    const logger = createMockLogger();
    const db = createMockDb(4);
    db.execute
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValueOnce([{ count: 4 }]);

    const service = new DbMetricsService(
      asLogger(logger),
      createMockMetrics(),
      db,
      createMockConfig('worker'),
    );
    service.onModuleInit();

    await vi.advanceTimersByTimeAsync(0);
    expect(logger.warn).toHaveBeenCalledTimes(1); // first failure

    await vi.advanceTimersByTimeAsync(15_000);
    expect(logger.warn).toHaveBeenCalledTimes(1); // deduped — still 1

    await vi.advanceTimersByTimeAsync(15_000);
    expect(logger.info).toHaveBeenCalledWith('db_active_connections poll recovered');
  });

  it('filters SQL by application_name matching SERVICE_NAME', async () => {
    const db = createMockDb(2);
    const service = new DbMetricsService(
      asLogger(createMockLogger()),
      createMockMetrics(),
      db,
      createMockConfig('ingestion-api'),
    );

    service.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);

    const call = db.execute.mock.calls[0]?.[0] as { queryChunks?: unknown[] } | undefined;
    // Drizzle sql`` tag — assert the service name is present in the parameter chunks
    const serialized = JSON.stringify(call);
    expect(serialized).toContain('ingestion-api');
  });
});
