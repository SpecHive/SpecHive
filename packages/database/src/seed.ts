/* eslint-disable no-console */
import 'dotenv/config';
import { randomBytes, createHash } from 'node:crypto';

import { MembershipRole } from '@assertly/shared-types';
import { hash } from 'argon2';

import { createDbConnection } from './connection.js';
import { projects, projectTokens } from './schema/project.js';
import { organizations, users, memberships } from './schema/tenant.js';

async function seed() {
  const db = createDbConnection();

  console.log('Seeding database...');

  const [org] = await db
    .insert(organizations)
    .values({ name: 'Assertly', slug: 'assertly' })
    .returning();

  const passwordHash = await hash('changeme', { type: 2 }); // argon2id
  const [user] = await db
    .insert(users)
    .values({
      email: 'admin@assertly.dev',
      passwordHash,
      name: 'Admin',
    })
    .returning();

  await db.insert(memberships).values({
    organizationId: org!.id,
    userId: user!.id,
    role: MembershipRole.Owner,
  });

  const [project] = await db
    .insert(projects)
    .values({
      organizationId: org!.id,
      name: 'Default Project',
      slug: 'default-project',
    })
    .returning();

  const plainToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(plainToken).digest('hex');

  await db.insert(projectTokens).values({
    projectId: project!.id,
    name: 'Default Token',
    tokenHash,
  });

  console.log('Seed completed successfully.');
  console.log(`Project token (save this, it will not be shown again): ${plainToken}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
