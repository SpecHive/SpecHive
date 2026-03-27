/**
 * Build a Postgres connection URL for the superuser role (bypasses RLS).
 * Reads ADMIN_DATABASE_URL first, then falls back to POSTGRES_* env vars.
 */
export function buildSuperuserDatabaseUrl(): string {
  if (process.env['ADMIN_DATABASE_URL']) return process.env['ADMIN_DATABASE_URL'];
  const user = process.env['POSTGRES_USER'] ?? 'spechive';
  const pass = process.env['POSTGRES_PASSWORD'] ?? 'spechive';
  const host = process.env['POSTGRES_HOST'] ?? 'localhost';
  const port = process.env['POSTGRES_PORT'] ?? '5432';
  const db = process.env['POSTGRES_DB'] ?? 'spechive';
  return `postgres://${user}:${pass}@${host}:${port}/${db}`;
}

export function buildAppDatabaseUrl(): string {
  if (process.env['APP_DATABASE_URL']) return process.env['APP_DATABASE_URL'];
  if (process.env['DATABASE_URL']) return process.env['DATABASE_URL'];
  const host = process.env['POSTGRES_HOST'] ?? 'localhost';
  const port = process.env['POSTGRES_PORT'] ?? '5432';
  return `postgres://spechive_app:spechive_app@${host}:${port}/spechive`;
}

export async function createPostgresConnection(url: string) {
  const postgres = (await import('postgres')).default;
  return postgres(url, { max: 1 });
}

export async function setTenantContextRaw(
  sql: ReturnType<Awaited<ReturnType<typeof createPostgresConnection>>>,
  orgId: string,
): Promise<void> {
  await sql`SELECT set_config('app.current_organization_id', ${orgId}, true)`;
}
