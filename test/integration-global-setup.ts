/**
 * Vitest globalSetup for integration tests.
 *
 * Seeds a known organization, project, and project token into Postgres
 * so that `x-project-token: test-token` is valid for integration tests.
 * All inserts use ON CONFLICT DO NOTHING for idempotency.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// globalSetup runs outside the Vitest env, so we must load .env manually.
function loadDotEnv(): void {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx);
      if (process.env[key] === undefined) {
        process.env[key] = trimmed.slice(eqIdx + 1);
      }
    }
  } catch {
    // No .env file — rely on existing env vars
  }
}

// Deterministic UUIDv7-like IDs for seeded data
const INTEGRATION_ORG_ID = '01970000-0000-7000-8000-000000000001';
const INTEGRATION_PROJECT_ID = '01970000-0000-7000-8000-000000000002';
const INTEGRATION_TOKEN_ID = '01970000-0000-7000-8000-000000000003';

const TEST_TOKEN = 'test-token';
const TOKEN_PREFIX_LENGTH = 16;

async function computeTestTokenHash(): Promise<string> {
  const { hash } = await import('argon2');
  return hash(TEST_TOKEN, { type: 2 });
}

export async function setup(): Promise<void> {
  loadDotEnv();

  const user = process.env['POSTGRES_USER'] ?? 'assertly';
  const pass = process.env['POSTGRES_PASSWORD'] ?? 'assertly';
  const db = process.env['POSTGRES_DB'] ?? 'assertly';
  const superuserUrl = `postgres://${user}:${pass}@localhost:5432/${db}`;

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
      INSERT INTO projects (id, organization_id, name, slug, created_at, updated_at)
      VALUES (
        ${INTEGRATION_PROJECT_ID},
        ${INTEGRATION_ORG_ID},
        'Integration Test Project',
        'integration-test',
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;

    const tokenHash = await computeTestTokenHash();
    const tokenPrefix = TEST_TOKEN.slice(0, TOKEN_PREFIX_LENGTH);

    await sql`
      INSERT INTO project_tokens (id, project_id, name, token_hash, token_prefix, created_at, updated_at)
      VALUES (
        ${INTEGRATION_TOKEN_ID},
        ${INTEGRATION_PROJECT_ID},
        'integration-test-token',
        ${tokenHash},
        ${tokenPrefix},
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;
  } finally {
    await sql.end();
  }
}

export async function teardown(): Promise<void> {
  // No-op — seeded data is disposable with `docker compose down -v`
}
