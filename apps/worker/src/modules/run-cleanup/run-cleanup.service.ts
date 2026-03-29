import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Database } from '@spechive/database';
import { DATABASE_CONNECTION } from '@spechive/nestjs-common';
import { InjectPinoLogger, PinoLogger } from '@spechive/nestjs-common';
import { sql } from 'drizzle-orm';

@Injectable()
export class RunCleanupService {
  constructor(
    @InjectPinoLogger(RunCleanupService.name) private readonly logger: PinoLogger,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  @Cron('0 * * * *')
  async cleanupOrphanedRuns(): Promise<void> {
    const result = await this.db.execute(sql`SELECT * FROM cleanup_orphaned_runs()`);

    this.logger.info(`Cancelled ${result.length} orphaned run(s)`);
    for (const row of result) {
      this.logger.info(`Cancelled orphaned run ${row.run_id}`);
    }
  }
}
