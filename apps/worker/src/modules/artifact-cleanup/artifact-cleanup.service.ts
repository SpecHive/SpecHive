import type { Database } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';

@Injectable()
export class ArtifactCleanupService {
  private readonly logger = new Logger(ArtifactCleanupService.name);

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  @Cron('*/5 * * * *')
  async cleanupStaleArtifacts(): Promise<void> {
    try {
      const rows = await this.db.execute<{ artifact_id: string }>(
        sql`SELECT artifact_id FROM cleanup_stale_pending_artifacts()`,
      );

      if (rows.length === 0) return;

      for (const row of rows) {
        this.logger.log(
          `Artifact ${row.artifact_id} marked as unretrievable (binary data lost after S3 failure)`,
        );
      }
      this.logger.log(`Cleaned up ${rows.length} failed artifacts`);
    } catch (error) {
      this.logger.error('Failed to clean up stale artifacts', error);
    }
  }
}
