import type { Database } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';

@Injectable()
export class RunCleanupService {
  private readonly logger = new Logger(RunCleanupService.name);

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  @Cron('0 * * * *')
  async cleanupOrphanedRuns(): Promise<void> {
    const result = await this.db.execute(sql`SELECT * FROM cleanup_orphaned_runs()`);

    this.logger.log(`Cancelled ${result.length} orphaned run(s)`);
    for (const row of result) {
      this.logger.log(`Cancelled orphaned run ${row.run_id}`);
    }
  }
}
