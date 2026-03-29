import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DATABASE_CONNECTION } from '../constants';

/**
 * Drizzle does not expose a public API for the underlying driver.
 * We access `$client` directly — the postgres-js `Sql` instance.
 * See also: packages/database/src/connection.ts getRawClient().
 */
interface DrizzleWithClient {
  $client?: { end(options?: { timeout?: number }): Promise<void> };
}

@Injectable()
export class DatabaseShutdownService implements OnModuleDestroy {
  constructor(
    @InjectPinoLogger(DatabaseShutdownService.name) private readonly logger: PinoLogger,
    @Inject(DATABASE_CONNECTION)
    private readonly db: unknown,
  ) {}

  async onModuleDestroy(): Promise<void> {
    const client = (this.db as DrizzleWithClient)?.$client;
    if (!client?.end) {
      this.logger.warn('Could not extract raw client from Drizzle instance — skipping pool close');
      return;
    }

    await client.end({ timeout: 5 });
    this.logger.info('Database pool closed');
  }
}
