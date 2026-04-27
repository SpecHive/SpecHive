import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Gauge } from 'prom-client';

import { DATABASE_CONNECTION } from '../constants';

import { METRICS_SERVICE } from './metrics.constants';
import type { MetricsService } from './metrics.service';

interface DrizzleDatabase {
  execute(query: unknown): Promise<unknown>;
}

const POLL_INTERVAL_MS = 15_000;

@Injectable()
export class DbMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly gauge: Gauge<string> | null;
  private readonly serviceName: string;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private lastPollFailed = false;

  constructor(
    @InjectPinoLogger(DbMetricsService.name) private readonly logger: PinoLogger,
    @Optional() @Inject(METRICS_SERVICE) metrics?: MetricsService,
    @Optional() @Inject(DATABASE_CONNECTION) private readonly db?: DrizzleDatabase,
    @Optional() config?: ConfigService,
  ) {
    const serviceName = config?.get<string>('SERVICE_NAME');
    if (!db || !metrics?.enabled || !serviceName) {
      this.serviceName = '';
      this.gauge = null;
      return;
    }

    this.serviceName = serviceName;
    // Fleet-wide per service: application_name is SERVICE_NAME, so replicas share the `service`
    // label and Prometheus aggregates into one time series. Add an `instance` label if per-replica
    // visibility is needed later (SpecHive is single-instance per service today).
    this.gauge = metrics.createGauge(
      'spechive_db_active_connections',
      'Active PostgreSQL connections for this service (filtered by application_name)',
      [],
    );
  }

  onModuleInit(): void {
    if (!this.gauge) return;
    void this.poll();
    this.intervalHandle = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this.gauge || !this.db) return;
    try {
      const result = await this.db.execute(
        sql`SELECT count(*)::int AS count FROM pg_stat_activity
            WHERE datname = current_database()
              AND application_name = ${this.serviceName}`,
      );
      // drizzle execute() returns different shapes depending on driver (array vs { rows })
      const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows;
      const count = (rows as { count: number }[] | undefined)?.[0]?.count;
      if (typeof count === 'number') {
        this.gauge.set(count);
      }
      if (this.lastPollFailed) {
        this.logger.info('db_active_connections poll recovered');
        this.lastPollFailed = false;
      }
    } catch (error) {
      // Deduplicated: log once on failure, once on recovery. Prometheus staleness (5min)
      // continues to handle prolonged outages — but silence breaks debugging.
      if (!this.lastPollFailed) {
        this.logger.warn({ err: error }, 'db_active_connections poll failed');
        this.lastPollFailed = true;
      }
    }
  }
}
