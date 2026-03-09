import type { Database } from '@assertly/database';
import { DATABASE_CONNECTION, S3Service } from '@assertly/nestjs-common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';

import type { EnvConfig } from '../config/env.validation';

const BATCH_SIZE = 1000;
const MAX_ITERATIONS = 100;

@Injectable()
export class ArtifactCleanupService {
  private readonly logger = new Logger(ArtifactCleanupService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly s3: S3Service,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  @Cron('0 3 * * *')
  async cleanupExpiredArtifacts(): Promise<void> {
    const retentionDays = this.config.get('ARTIFACT_RETENTION_DAYS', { infer: true })!;

    await this.db.transaction(async (tx) => {
      const [{ locked }] = await tx.execute<{ locked: boolean }>(
        sql`SELECT pg_try_advisory_xact_lock(hashtext('artifact_cleanup')) AS locked`,
      );

      if (!locked) {
        this.logger.log('Artifact cleanup already in progress, skipping');
        return;
      }

      let totalDeleted = 0;
      let iterations = 0;

      /*
       * Deletion order: S3 first, then DB. This is intentional.
       * Both failure modes are self-healing:
       * - S3 fails: loop breaks, DB rows intact. Next cron retries the same batch.
       * - DB fails after S3 succeeds: S3 objects gone, DB rows remain. Next cron
       *   re-fetches same rows, S3 deleteMany is idempotent for missing objects,
       *   then retries DB delete.
       * Reversing the order (DB-first) would create permanent S3 orphans if S3
       * fails after the DB rows are deleted, since storage paths would be lost.
       */
      while (iterations < MAX_ITERATIONS) {
        iterations++;

        const expired = await tx.execute<{ artifact_id: string; storage_path: string }>(
          sql`SELECT * FROM get_expired_artifacts(${retentionDays}, ${BATCH_SIZE})`,
        );

        if (expired.length === 0) break;

        const storagePaths = expired.map((a) => a.storage_path);
        const ids = expired.map((a) => a.artifact_id);

        try {
          await this.s3.deleteMany(storagePaths);
          await tx.execute(sql`SELECT delete_artifacts_by_ids(${ids}::uuid[])`);
          totalDeleted += expired.length;
          this.logger.log(`Deleted batch of ${expired.length} expired artifact(s)`);
        } catch (error) {
          this.logger.error(`Failed to delete batch of ${expired.length} artifact(s)`, error);
          break;
        }
      }

      if (iterations >= MAX_ITERATIONS) {
        this.logger.warn(
          `Artifact cleanup hit iteration limit (${MAX_ITERATIONS}). Some artifacts may remain.`,
        );
      }

      this.logger.log(`Artifact cleanup complete: ${totalDeleted} artifact(s) deleted`);
    });
  }
}
