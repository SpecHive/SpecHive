/** Requires: DatabaseModule (DATABASE_CONNECTION token) */
export { AnalyticsModule } from './analytics/analytics.module';

/** Requires: DatabaseModule (DATABASE_CONNECTION token), S3Module (S3Service) */
export { ArtifactsModule } from './artifacts/artifacts.module';

/**
 * Requires: DatabaseModule (DATABASE_CONNECTION token),
 * ConfigService with JWT_SECRET, JWT_ACCESS_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN
 */
export { AuthModule } from './auth/auth.module';

/** Requires: DatabaseModule (DATABASE_CONNECTION token), ConfigService with DASHBOARD_URL or CORS_ORIGIN */
export { InvitationsModule } from './invitations/invitations.module';

/** Requires: DatabaseModule (DATABASE_CONNECTION token) */
export { MembersModule } from './members/members.module';

/** Requires: DatabaseModule (DATABASE_CONNECTION token) */
export { ProjectsModule } from './projects/projects.module';

/** Requires: DatabaseModule (DATABASE_CONNECTION token) */
export { RunsModule } from './runs/runs.module';

/** Requires: DatabaseModule (DATABASE_CONNECTION token) */
export { SuitesModule } from './suites/suites.module';

/** Requires: DatabaseModule (DATABASE_CONNECTION token) */
export { TestsModule } from './tests/tests.module';

/** Requires: DatabaseModule (DATABASE_CONNECTION token) */
export { TokensModule } from './tokens/tokens.module';

// Excluded: ConfigModule (app-specific env schema)
