/**
 * Requires: DatabaseModule (DATABASE_CONNECTION token), S3Module (S3Service),
 * ConfigService with ARTIFACT_RETENTION_DAYS
 */
export { ArtifactCleanupModule } from './artifact-cleanup/artifact-cleanup.module';

/**
 * Requires: DatabaseModule (DATABASE_CONNECTION token), OutboxyModule (INBOXY_CLIENT token),
 * S3Module (S3Service — used by handlers). Imports DiscoveryModule internally.
 */
export { ResultProcessorModule } from './result-processor/result-processor.module';

/** Requires: DatabaseModule (DATABASE_CONNECTION token) */
export { RunCleanupModule } from './run-cleanup/run-cleanup.module';

/** Requires: ResultProcessorModule (imports it internally) */
export { WebhookReceiverModule } from './webhook-receiver/webhook-receiver.module';

// Excluded: ConfigModule (app-specific env schema)
