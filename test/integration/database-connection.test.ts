import { asOrganizationId } from '@spechive/shared-types';
import postgres from 'postgres';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import {
  createDbConnection,
  getRawClient,
  setTenantContext,
} from '../../packages/database/src/connection.js';
import { buildSuperuserDatabaseUrl } from '../helpers';

const DATABASE_URL = buildSuperuserDatabaseUrl();

describe('getRawClient', () => {
  let db: ReturnType<typeof createDbConnection>;

  beforeAll(async () => {
    try {
      const sql = postgres(DATABASE_URL, { max: 1 });
      await sql`SELECT 1`;
      await sql.end();
    } catch {
      throw new Error(
        `Postgres is not accessible at ${DATABASE_URL}. ` +
          `Start Docker services: docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres`,
      );
    }

    db = createDbConnection(DATABASE_URL, 1);
  });

  afterAll(async () => {
    const client = getRawClient(db);
    await client.end();
  });

  it('returns a postgres.js Sql instance from a Drizzle database', () => {
    const client = getRawClient(db);
    expect(client).toBeDefined();
    expect(typeof client.begin).toBe('function');
  });

  it('returns a usable client from a Drizzle transaction', async () => {
    await db.transaction(async (tx) => {
      const client = getRawClient(tx);
      expect(client).toBeDefined();
      const [row] = await client`SELECT 1 AS val`;
      expect(row!.val).toBe(1);
    });
  });

  it('transaction client shares the same transactional context', async () => {
    await db.transaction(async (tx) => {
      const client = getRawClient(tx);
      await client`SELECT set_config('app.current_organization_id', 'test-org-id', true)`;
      const [row] = await client`SELECT current_setting('app.current_organization_id') AS org_id`;
      expect(row!.org_id).toBe('test-org-id');
    });
  });

  it('throws for an invalid input', () => {
    expect(() => getRawClient({} as never)).toThrow('Failed to extract raw client');
  });
});

describe('setTenantContext', () => {
  let db: ReturnType<typeof createDbConnection>;

  beforeAll(async () => {
    try {
      const sql = postgres(DATABASE_URL, { max: 1 });
      await sql`SELECT 1`;
      await sql.end();
    } catch {
      throw new Error(
        `Postgres is not accessible at ${DATABASE_URL}. ` +
          `Start Docker services: docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres`,
      );
    }

    db = createDbConnection(DATABASE_URL, 1);
  });

  afterAll(async () => {
    const client = getRawClient(db);
    await client.end();
  });

  it('sets the organization ID within a transaction', async () => {
    const orgId = asOrganizationId('01970000-0000-7000-8000-000000000099');

    await db.transaction(async (tx) => {
      await setTenantContext(tx, orgId);

      const client = getRawClient(tx);
      const [row] = await client`SELECT current_setting('app.current_organization_id') AS org_id`;
      expect(row!.org_id).toBe(orgId);
    });
  });

  it('setting is transaction-scoped and not visible outside', async () => {
    const orgId = asOrganizationId('01970000-0000-7000-8000-000000000088');

    await db.transaction(async (tx) => {
      await setTenantContext(tx, orgId);
    });

    // Transaction-scoped setting should not persist outside
    const client = getRawClient(db);
    const [row] = await client`
      SELECT current_setting('app.current_organization_id', true) AS org_id
    `;
    expect(row!.org_id === null || row!.org_id === '').toBe(true);
  });
});
