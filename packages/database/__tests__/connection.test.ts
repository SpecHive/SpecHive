/**
 * Connection utility tests (getRawClient, setTenantContext).
 *
 * These require a real Postgres connection. The suite is skipped when the DB
 * is unreachable, following the same pattern as migrations.test.ts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const DATABASE_URL =
  process.env['ADMIN_DATABASE_URL'] ??
  (() => {
    const user = process.env['POSTGRES_USER'] ?? 'assertly';
    const pass = process.env['POSTGRES_PASSWORD'] ?? 'assertly';
    const db = process.env['POSTGRES_DB'] ?? 'assertly';
    return `postgres://${user}:${pass}@localhost:5432/${db}`;
  })();

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- dynamic import requires value-level typeof
let postgres: typeof import('postgres').default;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- dynamic import requires value-level typeof
let createDbConnection: typeof import('../src/connection.js').createDbConnection;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- dynamic import requires value-level typeof
let getRawClient: typeof import('../src/connection.js').getRawClient;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- dynamic import requires value-level typeof
let setTenantContext: typeof import('../src/connection.js').setTenantContext;

const canConnect = await (async () => {
  try {
    const mod = await import('postgres');
    postgres = mod.default;
    const sql = postgres(DATABASE_URL, { max: 1 });
    await sql`SELECT 1`;
    await sql.end();

    const connMod = await import('../src/connection.js');
    createDbConnection = connMod.createDbConnection;
    getRawClient = connMod.getRawClient;
    setTenantContext = connMod.setTenantContext;

    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!canConnect)('getRawClient', () => {
  let db: ReturnType<typeof createDbConnection>;

  beforeAll(() => {
    db = createDbConnection(DATABASE_URL, 1);
  });

  afterAll(async () => {
    const client = getRawClient(db);
    await client.end();
  });

  it('returns a postgres.js Sql instance from a Drizzle database', () => {
    const client = getRawClient(db);
    expect(client).toBeDefined();
    // postgres.js clients expose a `.begin` method
    expect(typeof client.begin).toBe('function');
  });

  it('returns a usable client from a Drizzle transaction', async () => {
    await db.transaction(async (tx) => {
      const client = getRawClient(tx);
      expect(client).toBeDefined();
      // Verify the client can execute queries
      const [row] = await client`SELECT 1 AS val`;
      expect(row!.val).toBe(1);
    });
  });

  it('throws for an invalid input', () => {
    expect(() => getRawClient({} as never)).toThrow('Failed to extract raw client');
  });
});

describe.skipIf(!canConnect)('setTenantContext', () => {
  let db: ReturnType<typeof createDbConnection>;

  beforeAll(() => {
    db = createDbConnection(DATABASE_URL, 1);
  });

  afterAll(async () => {
    const client = getRawClient(db);
    await client.end();
  });

  it('sets the organization ID within a transaction', async () => {
    const orgId = '01970000-0000-7000-8000-000000000099';

    await db.transaction(async (tx) => {
      await setTenantContext(tx, orgId);

      const client = getRawClient(tx);
      const [row] = await client`SELECT current_setting('app.current_organization_id') AS org_id`;
      expect(row!.org_id).toBe(orgId);
    });
  });

  it('setting is transaction-scoped and not visible outside', async () => {
    const orgId = '01970000-0000-7000-8000-000000000088';

    await db.transaction(async (tx) => {
      await setTenantContext(tx, orgId);
    });

    // Outside the transaction, the setting should be empty or raise an error
    const client = getRawClient(db);
    const [row] = await client`
      SELECT current_setting('app.current_organization_id', true) AS org_id
    `;
    // The setting is either null/empty or the default (empty string) outside a transaction
    expect(row!.org_id === null || row!.org_id === '').toBe(true);
  });
});
