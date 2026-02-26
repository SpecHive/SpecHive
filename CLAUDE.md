# Assertly

Assertly is a multi-tenant test reporting platform that ingests test results from CI runners, stores artifacts in S3-compatible storage, and presents dashboards. Built with NestJS (backend), React/Vite (dashboard), Drizzle ORM, and PostgreSQL with row-level security.

## Repository structure

```
apps/
  ingestion-api/   NestJS API — receives reporter events (port 3000)
  worker/          NestJS worker — processes outbox events (port 3001)
  dashboard/       React/Vite SPA (port 5173)

packages/
  database/              Drizzle schema, migrations, seed, connection helpers
  shared-types/          Branded ID types and enums (shared across all packages)
  reporter-core-protocol/ Protocol types for test reporters
  nestjs-common/         Shared NestJS modules (config, filters, health)
  eslint-config/         Shared ESLint flat config
  typescript-config/     Shared tsconfig bases
```

## Prerequisites

- Node.js >= 22
- pnpm >= 9
- Docker & Docker Compose (for Postgres, MinIO, Outboxy)

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm build
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## Running tests

### Unit tests (no infrastructure)

```bash
pnpm test
```

Runs each package's `test` script. No Docker services required.

### DB integration tests (Postgres only)

These test RLS policies against a live database. Steps:

```bash
# 1. Start Postgres (creates the assertly_app role via docker/postgres/init.sh)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres

# 2. Build packages that migrations depend on
pnpm --filter @assertly/shared-types build
pnpm --filter @assertly/database build

# 3. Generate and run migrations (as superuser)
DATABASE_URL=postgres://assertly:assertly@localhost:5432/assertly pnpm db:generate
DATABASE_URL=postgres://assertly:assertly@localhost:5432/assertly pnpm db:migrate

# 4. Run DB integration tests
pnpm test:integration:db
```

Config: `test/vitest.integration-db.config.ts` — matches only `test/integration/rls-*.test.ts`.

The tests connect as both the superuser (`assertly`) and the app role (`assertly_app`), seeding data via superuser and verifying RLS isolation via the app role.

### Full integration tests (entire Docker stack)

```bash
# 1. Start all services
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 2. Build, generate, migrate (same as above)

# 3. Run full integration suite (token seeding is automatic via globalSetup)
pnpm test:integration
```

Config: `test/vitest.integration.config.ts` — matches all `test/integration/**/*.test.ts`. Tests run sequentially (`maxWorkers: 1`) with 30s timeout. The `globalSetup` hook (`test/integration-global-setup.ts`) automatically seeds a test organization, project, and project token (`test-token`) before the suite runs.

## Database architecture

### Two-role model

| Role                      | Connection string                                              | Purpose                                       |
| ------------------------- | -------------------------------------------------------------- | --------------------------------------------- |
| `assertly` (superuser)    | `postgres://assertly:assertly@localhost:5432/assertly`         | Migrations, seeding, admin ops — bypasses RLS |
| `assertly_app` (app role) | `postgres://assertly_app:assertly_app@localhost:5432/assertly` | Application queries — subject to RLS policies |

The app role is created by `docker/postgres/init.sh`, which runs on first Postgres startup. If you reset the Postgres volume, this script runs again automatically.

### Row-Level Security (RLS)

All tenant-scoped tables (projects, runs, suites, tests, artifacts) have RLS policies that filter rows by `app.current_organization_id`. The application **must** set this context per transaction:

```typescript
import { setTenantContext } from '@assertly/database';

await db.transaction(async (tx) => {
  await setTenantContext(tx, organizationId);
  // All queries in this transaction are now scoped to the organization
});
```

Under the hood, `setTenantContext` calls `SET LOCAL app.current_organization_id`. Without it, queries return zero rows (fail-closed).

### Schema hierarchy

`organizations` → `projects` → `runs` → `suites` → `tests` → `artifacts`

Tenant boundary is at the organization level. RLS propagates down through foreign key joins.

## Key conventions

- **Branded IDs**: All entity IDs use UUIDv7 with TypeScript branded types (`OrganizationId`, `ProjectId`, etc.) to prevent accidental mixing. Cast with `asProjectId(str)`.
- **ES modules**: All packages use ESM. Imports must include `.js` extensions (`import { foo } from './bar.js'`).
- **Strict TypeScript**: `strict: true` in all tsconfigs. No `any` without justification.
- **Conventional commits**: Enforced by commitlint — `feat:`, `fix:`, `chore:`, etc.
- **Drizzle ORM**: Schema defined in `packages/database/src/schema/`. Migrations in `packages/database/drizzle/`.

## Environment variables

See `.env.example` for the full list. Critical variables:

| Variable                              | Purpose                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`                        | App-role connection string (used by NestJS apps, subject to RLS)        |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | Superuser credentials (used by migrations and Docker)                   |
| `ASSERTLY_APP_PASSWORD`               | Password for the `assertly_app` role (used in `init.sh`)                |
| `MINIO_ENDPOINT`                      | S3-compatible storage endpoint for artifacts                            |
| `WEBHOOK_SECRET`                      | Shared secret for Outboxy webhook delivery (min 32 chars in production) |
| `OUTBOXY_API_URL`                     | URL to the Outboxy transactional outbox API                             |

## Important rules

- **NestJS apps compile to CJS**: Despite packages using ESM, the NestJS apps (`ingestion-api`, `worker`) produce CommonJS output via their build step. Do not add `"type": "module"` to their `package.json`.
- **Migrations use the superuser role**: Never run `db:migrate` with `DATABASE_URL` pointing to `assertly_app` — the app role lacks DDL permissions.
- **Seeding uses the superuser role**: The seed script (`pnpm db:seed`) must connect as the superuser to bypass RLS. It accepts `SEED_DATABASE_URL` or falls back to `DATABASE_URL`.
- **Docker Postgres init.sh only runs once**: On a fresh volume. If you need to recreate the `assertly_app` role, either `docker compose down -v` and restart, or create the role manually.
- **Build order matters**: `shared-types` → `reporter-core-protocol` → `database` → `nestjs-common` → apps. `pnpm build` handles this via workspace topology.
- **Two-file compose strategy**: `docker-compose.yml` is the production base (no host port bindings). `docker-compose.dev.yml` adds host ports, hot-reload, and dev settings. Local development always uses both files: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d`.
- **CI workflows are frozen**: Do not modify `.github/workflows/` files. The project is in early development; CI will be refined later.
