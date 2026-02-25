/* eslint-disable no-console */
import 'dotenv/config';
import { randomBytes, createHash } from 'node:crypto';

import { MembershipRole, RunStatus, TestStatus } from '@assertly/shared-types';
import { hash } from 'argon2';

import { createDbConnection } from './connection.js';
import { runs, suites, tests } from './schema/execution.js';
import { projects, projectTokens } from './schema/project.js';
import { organizations, users, memberships } from './schema/tenant.js';

async function seed() {
  const db = createDbConnection();

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
        where: (p, { eq }) => eq(p.slug, 'default-project'),
      }));

    if (!seedProject) throw new Error('Failed to seed project');

    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(plainToken).digest('hex');

    await db
      .insert(projectTokens)
      .values({
        projectId: seedProject.id,
        name: 'Default Token',
        tokenHash,
      })
      .onConflictDoNothing();

    // Execution fixture data: 1 passed run, 1 failed run with tests
    const [passedRun] = await db
      .insert(runs)
      .values({
        projectId: seedProject.id,
        status: RunStatus.Passed,
        totalTests: 2,
        passedTests: 2,
        failedTests: 0,
        skippedTests: 0,
        startedAt: new Date('2026-02-24T10:00:00Z'),
        finishedAt: new Date('2026-02-24T10:01:00Z'),
      })
      .returning();

    const [failedRun] = await db
      .insert(runs)
      .values({
        projectId: seedProject.id,
        status: RunStatus.Failed,
        totalTests: 2,
        passedTests: 1,
        failedTests: 1,
        skippedTests: 0,
        startedAt: new Date('2026-02-24T11:00:00Z'),
        finishedAt: new Date('2026-02-24T11:01:00Z'),
      })
      .returning();

    if (passedRun && failedRun) {
      const [passedSuite] = await db
        .insert(suites)
        .values({ runId: passedRun.id, name: 'Auth Suite' })
        .returning();

      const [failedSuite] = await db
        .insert(suites)
        .values({ runId: failedRun.id, name: 'Auth Suite' })
        .returning();

      if (passedSuite) {
        await db.insert(tests).values([
          {
            suiteId: passedSuite.id,
            runId: passedRun.id,
            name: 'should login successfully',
            status: TestStatus.Passed,
            durationMs: 120,
            startedAt: new Date('2026-02-24T10:00:01Z'),
            finishedAt: new Date('2026-02-24T10:00:02Z'),
          },
          {
            suiteId: passedSuite.id,
            runId: passedRun.id,
            name: 'should register new user',
            status: TestStatus.Passed,
            durationMs: 250,
            startedAt: new Date('2026-02-24T10:00:02Z'),
            finishedAt: new Date('2026-02-24T10:00:05Z'),
          },
        ]);
      }

      if (failedSuite) {
        await db.insert(tests).values([
          {
            suiteId: failedSuite.id,
            runId: failedRun.id,
            name: 'should login successfully',
            status: TestStatus.Passed,
            durationMs: 115,
            startedAt: new Date('2026-02-24T11:00:01Z'),
            finishedAt: new Date('2026-02-24T11:00:02Z'),
          },
          {
            suiteId: failedSuite.id,
            runId: failedRun.id,
            name: 'should handle invalid credentials',
            status: TestStatus.Failed,
            durationMs: 340,
            errorMessage: 'Expected 401 but received 200',
            stackTrace: 'at Object.<anonymous> (auth.test.ts:42:5)',
            startedAt: new Date('2026-02-24T11:00:02Z'),
            finishedAt: new Date('2026-02-24T11:00:05Z'),
          },
        ]);
      }
    }

    console.log('Seed completed successfully.');
    console.log(`Project token (save this, it will not be shown again): ${plainToken}`);
  } finally {
    // Ensure connection is cleaned up
    const client = (db as unknown as { $client: { end: () => Promise<void> } }).$client;
    await client.end();
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
