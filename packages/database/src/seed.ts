/* eslint-disable no-console */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ArtifactType, MembershipRole, RunStatus, TestStatus } from '@assertly/shared-types';
import { hash } from 'argon2';

import { createDbConnection, getRawClient } from './connection.js';
import { artifacts, runs, suites, tests } from './schema/execution.js';
import { projects, projectTokens } from './schema/project.js';
import { organizations, users, memberships } from './schema/tenant.js';

export async function seed(dbUrl?: string) {
  const url = dbUrl ?? process.env['SEED_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (!url) throw new Error('SEED_DATABASE_URL or DATABASE_URL environment variable is required');
  const db = createDbConnection(url);

  try {
    console.log('Seeding database...');

    const [org] = await db
      .insert(organizations)
      .values({ name: 'Assertly', slug: 'assertly' })
      .onConflictDoNothing()
      .returning();

    // If org already exists, find it
    const seedOrg =
      org ??
      (await db.query.organizations.findFirst({
        where: (orgs, { eq }) => eq(orgs.slug, 'assertly'),
      }));

    if (!seedOrg) throw new Error('Failed to seed organization');

    const passwordHash = await hash('changeme', { type: 2 });
    const [user] = await db
      .insert(users)
      .values({
        email: 'admin@assertly.dev',
        passwordHash,
        name: 'Admin',
      })
      .onConflictDoNothing()
      .returning();

    const seedUser =
      user ??
      (await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.email, 'admin@assertly.dev'),
      }));

    if (!seedUser) throw new Error('Failed to seed user');

    await db
      .insert(memberships)
      .values({
        organizationId: seedOrg.id,
        userId: seedUser.id,
        role: MembershipRole.Owner,
      })
      .onConflictDoNothing();

    const [project] = await db
      .insert(projects)
      .values({
        organizationId: seedOrg.id,
        name: 'Default Project',
        slug: 'default-project',
      })
      .onConflictDoNothing()
      .returning();

    const seedProject =
      project ??
      (await db.query.projects.findFirst({
        where: (p, { eq, and }) =>
          and(eq(p.slug, 'default-project'), eq(p.organizationId, seedOrg.id)),
      }));

    if (!seedProject) throw new Error('Failed to seed project');

    const TOKEN_PREFIX_LENGTH = 16;
    const plainToken = randomBytes(32).toString('hex');
    const tokenPrefix = plainToken.slice(0, TOKEN_PREFIX_LENGTH);
    const tokenHash = await hash(plainToken, { type: 2 });

    await db
      .insert(projectTokens)
      .values({
        projectId: seedProject.id,
        name: 'Default Token',
        tokenHash,
        tokenPrefix,
      })
      .onConflictDoNothing();

    // Execution fixture data: 1 passed run, 1 failed run with tests
    const [passedRun] = await db
      .insert(runs)
      .values({
        projectId: seedProject.id,
        organizationId: seedOrg.id,
        status: RunStatus.Passed,
        totalTests: 2,
        passedTests: 2,
        failedTests: 0,
        skippedTests: 0,
        startedAt: new Date('2026-02-24T10:00:00Z'),
        finishedAt: new Date('2026-02-24T10:01:00Z'),
      })
      .onConflictDoNothing()
      .returning();

    const [failedRun] = await db
      .insert(runs)
      .values({
        projectId: seedProject.id,
        organizationId: seedOrg.id,
        status: RunStatus.Failed,
        totalTests: 2,
        passedTests: 1,
        failedTests: 1,
        skippedTests: 0,
        startedAt: new Date('2026-02-24T11:00:00Z'),
        finishedAt: new Date('2026-02-24T11:01:00Z'),
      })
      .onConflictDoNothing()
      .returning();

    if (passedRun && failedRun) {
      const [passedSuite] = await db
        .insert(suites)
        .values({ runId: passedRun.id, organizationId: seedOrg.id, name: 'Auth Suite' })
        .onConflictDoNothing()
        .returning();

      const [failedSuite] = await db
        .insert(suites)
        .values({ runId: failedRun.id, organizationId: seedOrg.id, name: 'Auth Suite' })
        .onConflictDoNothing()
        .returning();

      if (passedSuite) {
        const passedTests = await db
          .insert(tests)
          .values([
            {
              suiteId: passedSuite.id,
              runId: passedRun.id,
              organizationId: seedOrg.id,
              name: 'should login successfully',
              status: TestStatus.Passed,
              durationMs: 120,
              startedAt: new Date('2026-02-24T10:00:01Z'),
              finishedAt: new Date('2026-02-24T10:00:02Z'),
            },
            {
              suiteId: passedSuite.id,
              runId: passedRun.id,
              organizationId: seedOrg.id,
              name: 'should register new user',
              status: TestStatus.Passed,
              durationMs: 250,
              startedAt: new Date('2026-02-24T10:00:02Z'),
              finishedAt: new Date('2026-02-24T10:00:05Z'),
            },
          ])
          .onConflictDoNothing()
          .returning();

        for (const t of passedTests) {
          await db
            .insert(artifacts)
            .values({
              testId: t.id,
              organizationId: seedOrg.id,
              type: ArtifactType.Screenshot,
              name: `${t.name}.png`,
              storagePath: `assertly-artifacts/${seedProject.id}/${passedRun.id}/${t.id}/screenshot.png`,
              sizeBytes: 24_576,
              mimeType: 'image/png',
            })
            .onConflictDoNothing();
        }
      }

      if (failedSuite) {
        const failedTests = await db
          .insert(tests)
          .values([
            {
              suiteId: failedSuite.id,
              runId: failedRun.id,
              organizationId: seedOrg.id,
              name: 'should login successfully',
              status: TestStatus.Passed,
              durationMs: 115,
              startedAt: new Date('2026-02-24T11:00:01Z'),
              finishedAt: new Date('2026-02-24T11:00:02Z'),
            },
            {
              suiteId: failedSuite.id,
              runId: failedRun.id,
              organizationId: seedOrg.id,
              name: 'should handle invalid credentials',
              status: TestStatus.Failed,
              durationMs: 340,
              errorMessage: 'Expected 401 but received 200',
              stackTrace: 'at Object.<anonymous> (auth.test.ts:42:5)',
              startedAt: new Date('2026-02-24T11:00:02Z'),
              finishedAt: new Date('2026-02-24T11:00:05Z'),
            },
          ])
          .onConflictDoNothing()
          .returning();

        for (const t of failedTests) {
          await db
            .insert(artifacts)
            .values({
              testId: t.id,
              organizationId: seedOrg.id,
              type: t.status === TestStatus.Failed ? ArtifactType.Trace : ArtifactType.Screenshot,
              name: t.status === TestStatus.Failed ? `${t.name}.trace` : `${t.name}.png`,
              storagePath: `assertly-artifacts/${seedProject.id}/${failedRun.id}/${t.id}/${t.status === TestStatus.Failed ? 'trace.json' : 'screenshot.png'}`,
              sizeBytes: t.status === TestStatus.Failed ? 102_400 : 24_576,
              mimeType: t.status === TestStatus.Failed ? 'application/json' : 'image/png',
            })
            .onConflictDoNothing();
        }
      }
    }

    console.log('Seed completed successfully.');
    console.log(`Project token (save this, it will not be shown again): ${plainToken}`);
  } finally {
    const client = getRawClient(db);
    await client.end();
  }
}

// CLI entry point
if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  if (process.env['NODE_ENV'] === 'production') {
    console.error('Seed script cannot run in production. Aborting.');
    process.exit(1);
  }
  seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
