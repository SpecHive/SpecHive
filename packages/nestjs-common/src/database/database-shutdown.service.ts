import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

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
  private readonly logger = new Logger(DatabaseShutdownService.name);

  constructor(
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
    this.logger.log('Database pool closed');
  }
}
