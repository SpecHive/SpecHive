/**
 * Vitest globalSetup for integration tests.
 *
 * Seeds a known organization, project, project token, and test user into Postgres
 * so that `x-project-token: test-token` is valid for ingestion-api tests and
 * login with `test-user@assertly.dev` / `test-password` works for query-api auth tests.
 * All inserts use ON CONFLICT DO NOTHING for idempotency.
 */

import { buildSuperuserDatabaseUrl } from './helpers/database';
import { loadDotEnvIntoProcess } from './helpers/load-dot-env';

// Deterministic UUIDv7-like IDs for seeded data
const INTEGRATION_ORG_ID = '01970000-0000-7000-8000-000000000001';
const INTEGRATION_PROJECT_ID = '01970000-0000-7000-8000-000000000002';
const INTEGRATION_TOKEN_ID = '01970000-0000-7000-8000-000000000003';
const INTEGRATION_USER_ID = '01970000-0000-7000-8000-000000000004';
const INTEGRATION_MEMBERSHIP_ID = '01970000-0000-7000-8000-000000000005';
const INTEGRATION_ORG2_ID = '01970000-0000-7000-8000-000000000006';
const INTEGRATION_MEMBERSHIP2_ID = '01970000-0000-7000-8000-000000000007';

const TEST_TOKEN = 'test-token';
const TEST_USER_EMAIL = 'test-user@assertly.dev';
const TEST_USER_PASSWORD = 'test-password';
const TOKEN_PREFIX_LENGTH = 16; // Synced with @assertly/shared-types — kept inline since globalSetup runs outside Vitest env

async function computeTestTokenHash(): Promise<string> {
  const { hash } = await import('argon2');
  return hash(TEST_TOKEN, { type: 2 });
}

async function computeTestPasswordHash(): Promise<string> {
  const { hash } = await import('argon2');
  return hash(TEST_USER_PASSWORD, { type: 2 });
}

export async function setup(): Promise<void> {
  loadDotEnvIntoProcess();

  const superuserUrl = buildSuperuserDatabaseUrl();

  const postgres = (await import('postgres')).default;
  const sql = postgres(superuserUrl, { max: 1 });

  try {
    await sql`
      INSERT INTO organizations (id, name, slug, created_at, updated_at)
      VALUES (
        ${INTEGRATION_ORG_ID},
        'Integration Test Org',
        'integration-test',
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO projects (id, organization_id, name, created_at, updated_at)
      VALUES (
        ${INTEGRATION_PROJECT_ID},
        ${INTEGRATION_ORG_ID},
        'Integration Test Project',
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;

    const tokenHash = await computeTestTokenHash();
    const tokenPrefix = TEST_TOKEN.slice(0, TOKEN_PREFIX_LENGTH);

    await sql`
      INSERT INTO project_tokens (id, project_id, organization_id, name, token_hash, token_prefix, created_at, updated_at)
      VALUES (
        ${INTEGRATION_TOKEN_ID},
        ${INTEGRATION_PROJECT_ID},
        ${INTEGRATION_ORG_ID},
        'integration-test-token',
        ${tokenHash},
        ${tokenPrefix},
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;

    const passwordHash = await computeTestPasswordHash();

    await sql`
      INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
      VALUES (
        ${INTEGRATION_USER_ID},
        ${TEST_USER_EMAIL},
        ${passwordHash},
        'Test User',
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO memberships (id, organization_id, user_id, role, created_at, updated_at)
      VALUES (
        ${INTEGRATION_MEMBERSHIP_ID},
        ${INTEGRATION_ORG_ID},
        ${INTEGRATION_USER_ID},
        'owner',
        NOW(),
        NOW()
      )
      ON CONFLICT (organization_id, user_id) DO NOTHING
    `;

    await sql`
      INSERT INTO organizations (id, name, slug, created_at, updated_at)
      VALUES (
        ${INTEGRATION_ORG2_ID},
        'Integration Test Org 2',
        'integration-test-2',
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO memberships (id, organization_id, user_id, role, created_at, updated_at)
      VALUES (
        ${INTEGRATION_MEMBERSHIP2_ID},
        ${INTEGRATION_ORG2_ID},
        ${INTEGRATION_USER_ID},
        'member',
        NOW(),
        NOW()
      )
      ON CONFLICT (organization_id, user_id) DO NOTHING
    `;
  } finally {
    await sql.end();
  }
}

export async function teardown(): Promise<void> {
  loadDotEnvIntoProcess();

  const superuserUrl = buildSuperuserDatabaseUrl();

  const postgres = (await import('postgres')).default;
  const sql = postgres(superuserUrl, { max: 1 });
  try {
    await sql`TRUNCATE artifacts, tests, suites, runs, project_tokens,
              memberships, projects, refresh_tokens, users, organizations CASCADE`;
  } finally {
    await sql.end();
  }
}
