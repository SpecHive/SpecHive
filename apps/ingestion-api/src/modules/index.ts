/** Requires: S3Module (S3Service) */
export { ArtifactsModule } from './artifacts/artifacts.module';

/**
 * Requires: DatabaseModule (DATABASE_CONNECTION token),
 * ConfigService with WORKER_WEBHOOK_URL and WEBHOOK_SECRET.
 * Configures its own OutboxyModule internally.
 */
export { IngestionModule } from './ingestion/ingestion.module';

// Excluded: ConfigModule (app-specific env schema)
