# Assertly

Assertly is a multi-tenant test reporting platform that ingests test results from CI runners, stores artifacts in S3-compatible storage, and presents dashboards. Built with NestJS (backend), React/Vite (dashboard), Drizzle ORM, and PostgreSQL with row-level security.

## Repository structure

```
apps/
  ingestion-api/   NestJS API — receives reporter events (port 3000)
  worker/          NestJS worker — processes outbox events (port 3001)
  query-api/       NestJS API — serve data to the dashboard (port 3002)
  dashboard/       React/Vite SPA (port 5173)

packages/
  api-types/             Typed API response interfaces
  database/              Drizzle schema, migrations, seed, connection helpers
  eslint-config/         Shared ESLint flat config
  nestjs-common/         Shared NestJS modules (config, filters, health)
  playwright-reporter/   Playwright reporter for Assertly
  reporter-core-protocol/ Protocol types for test reporters
  shared-types/          Branded ID types and enums (shared across all packages)
  typescript-config/     Shared tsconfig bases
```

## Key files

| File                                  | Purpose                                              |
| ------------------------------------- | ---------------------------------------------------- |
| `packages/database/src/connection.ts` | `setTenantContext()` for RLS, `createDbConnection()` |
| `packages/database/src/schema/*.ts`   | Drizzle schema definitions                           |
| `docker/postgres/init.sh`             | Creates `assertly_app` and `outboxy` roles           |
| `test/integration-global-setup.ts`    | Seeds test data (org, project, token, user)          |
| `commitlint.config.js`                | Conventional commit rules                            |
| `.env.example`                        | Full environment variable reference                  |

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

## Development workflow

### Build & type checking

```bash
pnpm build          # Build all packages and apps
pnpm typecheck      # TypeScript check all packages
```

### Linting & formatting

```bash
pnpm lint           # ESLint with zero warnings
pnpm format         # Format with Prettier
pnpm format:check   # Check formatting without writing
```

### Testing

```bash
pnpm test:unit      # Unit tests (no Docker required)
pnpm test:integration # Integration tests (requires Docker)
pnpm test           # All tests (unit then integration)
```

Integration tests use `test/vitest.integration.config.ts`, run sequentially (`maxWorkers: 1`) with 30s timeout. The `globalSetup` hook seeds test data automatically.

### Database

```bash
pnpm db:generate    # Generate Drizzle migrations from schema
pnpm db:migrate     # Apply pending migrations
pnpm db:seed        # Seed database with initial data
```

### Docker

```bash
pnpm docker:up      # Start all services
pnpm docker:down    # Stop all services
```

Local development uses both compose files: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d`

## Database architecture

### Two-role model

| Role                      | Connection string                                              | Purpose                                       |
| ------------------------- | -------------------------------------------------------------- | --------------------------------------------- |
| `assertly` (superuser)    | `postgres://assertly:assertly@localhost:5432/assertly`         | Migrations, seeding, admin ops — bypasses RLS |
| `assertly_app` (app role) | `postgres://assertly_app:assertly_app@localhost:5432/assertly` | Application queries — subject to RLS policies |
| `outboxy`                 | `postgres://outboxy:outboxy@localhost:5432/assertly`           | Outboxy transactional outbox                  |

The app role is created by `docker/postgres/init.sh`, which runs on first Postgres startup.

### Row-Level Security (RLS)

All tenant-scoped tables have RLS policies that filter rows by `app.current_organization_id`. The application **must** set this context per transaction:

```typescript
import { setTenantContext } from '@assertly/database';

await db.transaction(async (tx) => {
  await setTenantContext(tx, organizationId);
  // All queries in this transaction are now scoped to the organization
});
```

Without `setTenantContext`, queries return zero rows (fail-closed).

### Schema hierarchy

```
organizations ─→ projects ─→ runs ─→ suites ─→ tests ─→ artifacts
                  │
                  └─→ project_tokens

users ─→ memberships ←─ organizations

auth: refresh_tokens
```

Tenant boundary is at the organization level. RLS propagates down through foreign key joins.

## Environment variables

See `.env.example` for the full list with comments. Key variables:

### PostgreSQL

| Variable                              | Purpose                                     |
| ------------------------------------- | ------------------------------------------- |
| `DATABASE_URL`                        | App-role connection string (subject to RLS) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | Superuser credentials (migrations, Docker)  |
| `ASSERTLY_APP_PASSWORD`               | Password for `assertly_app` role            |
| `OUTBOXY_PASSWORD`                    | Password for `outboxy` role                 |

### Authentication

| Variable                 | Purpose                                      |
| ------------------------ | -------------------------------------------- |
| `TOKEN_HASH_KEY`         | Argon2 token hashing key (min 32 chars)      |
| `JWT_SECRET`             | JWT signing key (min 64 chars in production) |
| `JWT_ACCESS_EXPIRES_IN`  | Access token expiry (default: 15m)           |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry (default: 7d)           |

### Storage (MinIO)

| Variable                                        | Purpose                                   |
| ----------------------------------------------- | ----------------------------------------- |
| `MINIO_ENDPOINT`                                | S3-compatible storage endpoint (internal) |
| `MINIO_PUBLIC_ENDPOINT`                         | Public endpoint for presigned URLs        |
| `MINIO_BUCKET`                                  | Artifact storage bucket                   |
| `MINIO_APP_ACCESS_KEY` / `MINIO_APP_SECRET_KEY` | MinIO app credentials                     |

### Webhooks & Outboxy

| Variable             | Purpose                                       |
| -------------------- | --------------------------------------------- |
| `WEBHOOK_SECRET`     | Outboxy webhook authentication (min 32 chars) |
| `OUTBOXY_API_URL`    | Outboxy REST API URL                          |
| `WORKER_WEBHOOK_URL` | Worker's outboxy webhook endpoint             |

### Dashboard

| Variable       | Purpose                               |
| -------------- | ------------------------------------- |
| `VITE_API_URL` | Query API URL (inlined at build time) |

## Project-specific conventions

- **Branded IDs**: All entity IDs use UUIDv7 with TypeScript branded types (`OrganizationId`, `ProjectId`, etc.) to prevent accidental mixing. Cast with `asProjectId(str)`.
- **Conventional commits**: Enforced by commitlint — `feat:`, `fix:`, `chore:`, etc.
- **Drizzle ORM**: Schema defined in `packages/database/src/schema/`. Migrations in `packages/database/drizzle/`.

## Important rules

- **NestJS apps compile to CJS**: Despite packages using ESM, the NestJS apps (`ingestion-api`, `worker`, `query-api`) produce CommonJS output via their build step. Do not add `"type": "module"` to their `package.json`.
- **Migrations use the superuser role**: Never run `db:migrate` with `DATABASE_URL` pointing to `assertly_app` — the app role lacks DDL permissions.
- **Seeding uses the superuser role**: The seed script (`pnpm db:seed`) must connect as the superuser to bypass RLS. It accepts `SEED_DATABASE_URL` or falls back to `DATABASE_URL`.
- **Docker Postgres init.sh only runs once**: On a fresh volume. If you need to recreate the `assertly_app` role, either `docker compose down -v` and restart, or create the role manually.
- **Build order matters**: `shared-types` → `reporter-core-protocol` → `database` → `nestjs-common` → apps. `pnpm build` handles this via workspace topology.
- **Two-file compose strategy**: `docker-compose.yml` is the production base (no host port bindings). `docker-compose.dev.yml` adds host ports, hot-reload, and dev settings. Local development always uses both files.
