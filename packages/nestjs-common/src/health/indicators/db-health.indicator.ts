import { Inject, Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';
import { sql } from 'drizzle-orm';

import { DATABASE_CONNECTION } from '../../constants';

interface DrizzleDatabase {
  execute(query: unknown): Promise<unknown>;
}

@Injectable()
export class DbHealthIndicator extends HealthIndicator {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DrizzleDatabase) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const start = performance.now();
    try {
      await this.db.execute(sql`SELECT 1`);
      const responseTimeMs = Math.round(performance.now() - start);
      return this.getStatus(key, true, { responseTimeMs });
    } catch (error) {
      const responseTimeMs = Math.round(performance.now() - start);
      const message = error instanceof Error ? error.message : 'Unknown database error';
      throw new HealthCheckError(
        `${key} health check failed`,
        this.getStatus(key, false, { responseTimeMs, message }),
      );
    }
  }
}
