import { HealthCheckError } from '@nestjs/terminus';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DbHealthIndicator } from '../src/health/indicators/db-health.indicator';

describe('DbHealthIndicator', () => {
  let indicator: DbHealthIndicator;
  let mockDb: { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDb = { execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    indicator = new DbHealthIndicator(mockDb);
  });

  it('returns healthy with responseTimeMs on successful SELECT 1', async () => {
    const result = await indicator.isHealthy('database');

    expect(result.database.status).toBe('up');
    expect(result.database.responseTimeMs).toBeTypeOf('number');
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
  });

  it('throws HealthCheckError on connection error', async () => {
    mockDb.execute.mockRejectedValue(new Error('Connection refused'));

    await expect(indicator.isHealthy('database')).rejects.toThrow(HealthCheckError);
  });

  it('includes error message in unhealthy status', async () => {
    mockDb.execute.mockRejectedValue(new Error('Connection refused'));

    try {
      await indicator.isHealthy('database');
    } catch (error) {
      expect(error).toBeInstanceOf(HealthCheckError);
      const causes = (error as HealthCheckError).causes;
      expect(causes.database.status).toBe('down');
      expect(causes.database.message).toBe('Connection refused');
    }
  });
});
