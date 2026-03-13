# @assertly/database

Database schema, connection helpers, and migrations for [Assertly](https://github.com/assertly-dev/assertly).

## What's included

- **Drizzle ORM schema** — all table definitions with RLS policies
- **Connection helpers** — `createDbConnection()`, `createPostgresClient()`, `setTenantContext()`
- **Migrations** — 21 SQL migration files (0000–0020) in the `drizzle/` directory
- **Migration runner** — `runMigrations()` via the `./migrate` export

## Usage

```typescript
import { createDbConnection, setTenantContext } from '@assertly/database';

const db = createDbConnection(process.env.DATABASE_URL);

await db.transaction(async (tx) => {
  await setTenantContext(tx, organizationId);
  // All queries scoped to this organization via RLS
});
```

## Exports

| Export      | Content                     |
| ----------- | --------------------------- |
| `.`         | Schema + connection helpers |
| `./migrate` | `runMigrations()` function  |
| `./schema`  | Schema definitions only     |

## Requirements

- PostgreSQL 16+
- Superuser role for migrations (the app role lacks DDL permissions)
- `assertly_app` role for application queries (subject to RLS)

## License

[AGPL-3.0-only](./LICENSE)
