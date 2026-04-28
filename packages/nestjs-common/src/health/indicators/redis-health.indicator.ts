import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';
import type Redis from 'ioredis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Gauge } from 'prom-client';

import { REDIS_CLIENT } from '../../constants';
import { METRICS_SERVICE } from '../../metrics/metrics.constants';
import type { MetricsService } from '../../metrics/metrics.service';

const PING_INTERVAL_MS = 15_000;

@Injectable()
export class RedisHealthIndicator extends HealthIndicator implements OnModuleInit, OnModuleDestroy {
  private readonly connectedGauge: Gauge<string> | null;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private lastPingFailed = false;

  constructor(
    @InjectPinoLogger(RedisHealthIndicator.name) private readonly logger: PinoLogger,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
    @Optional() @Inject(METRICS_SERVICE) metrics?: MetricsService,
  ) {
    super();
    this.connectedGauge =
      this.redis && metrics?.enabled
        ? metrics.createGauge(
            'spechive_redis_connected',
            'Redis connection status (1=connected, 0=disconnected)',
            [],
          )
        : null;
  }

  onModuleInit(): void {
    // Periodic ping keeps the gauge fresh for Prometheus scrapes that only hit /metrics
    // — without this, spechive_redis_connected only updates when /health/ready is called,
    // so a silent Redis outage would never trip the RedisDown alert.
    if (!this.redis || !this.connectedGauge) return;
    void this.pingAndUpdate();
    this.intervalHandle = setInterval(() => void this.pingAndUpdate(), PING_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  isAvailable(): boolean {
    return this.redis != null;
  }

  // Gauge updates happen in pingAndUpdate() only — /health/ready must not mutate
  // the Prometheus-facing gauge (periodic poll is the single source of truth).
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    if (!this.redis) {
      return this.getStatus(key, true, { message: 'Redis not configured' });
    }

    const start = performance.now();
    try {
      await this.redis.ping();
      const responseTimeMs = Math.round(performance.now() - start);
      return this.getStatus(key, true, { responseTimeMs });
    } catch (error) {
      const responseTimeMs = Math.round(performance.now() - start);
      const message = error instanceof Error ? error.message : 'Unknown Redis error';
      throw new HealthCheckError(
        `${key} health check failed`,
        this.getStatus(key, false, { responseTimeMs, message }),
      );
    }
  }

  private async pingAndUpdate(): Promise<void> {
    if (!this.redis || !this.connectedGauge) return;
    try {
      await this.redis.ping();
      this.connectedGauge.set(1);
      // Deduplicated: log once on failure, once on recovery. Mirrors DbMetricsService —
      // without this, silent Redis outages on Railway (no external /health/ready traffic)
      // would only flip the gauge with no log trail.
      if (this.lastPingFailed) {
        this.logger.info('redis background ping recovered');
        this.lastPingFailed = false;
      }
    } catch (error) {
      this.connectedGauge.set(0);
      if (!this.lastPingFailed) {
        this.logger.warn({ err: error }, 'redis background ping failed');
        this.lastPingFailed = true;
      }
    }
  }
}
