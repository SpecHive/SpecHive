# Contributing to SpecHive

## Prerequisites

- Node.js >= 22
- pnpm >= 9
- Docker & Docker Compose

## Getting Started

```bash
git clone https://github.com/spechive-dev/spechive.git
cd spechive
cp .env.example .env
pnpm install
pnpm build
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
pnpm db:migrate
pnpm db:seed
```

The dev compose override (`docker-compose.dev.yml`) adds host port bindings and hot-reload. Always use both files for local development.

> **Note:** `.env.example` contains safe defaults for local development. `.env.production` is the template for deployment with `CHANGE_ME` placeholders for all secrets.

## Development Workflow

| Command                 | Description                               |
| ----------------------- | ----------------------------------------- |
| `pnpm build`            | Build all packages and apps               |
| `pnpm typecheck`        | TypeScript check across workspace         |
| `pnpm lint`             | ESLint (zero-warning policy)              |
| `pnpm format`           | Format with Prettier                      |
| `pnpm format:check`     | Check formatting without writing          |
| `pnpm test:unit`        | Unit tests (no Docker required)           |
| `pnpm test:integration` | Integration tests (requires Docker stack) |
| `pnpm test`             | All tests (unit then integration)         |
| `pnpm db:generate`      | Generate Drizzle migrations from schema   |
| `pnpm db:migrate`       | Apply pending migrations                  |
| `pnpm db:seed`          | Seed database with initial data           |

Before opening a pull request, ensure the full check suite passes:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## Commit Conventions

Commits are enforced by [commitlint](commitlint.config.js) and husky. The format is:

```
type(scope): description
```

**Allowed types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

The header must not exceed 100 characters.

**Examples:**

```
feat(dashboard): add test flakiness chart
fix(worker): handle missing artifact gracefully
docs: update deployment checklist
```

## Pull Request Process

1. Create a feature branch from `main`.
2. Make your changes following the code standards below.
3. Ensure the full check suite passes: `pnpm lint && pnpm typecheck && pnpm test`.
4. Open a PR against `main` with a clear description of what changed and why.

## Architecture Overview

See [README.md](README.md) for the data-flow diagram and monorepo structure.

**Build order matters.** Packages must be built in dependency order:

```
shared-types → reporter-core-protocol → database → nestjs-common → apps
```

`pnpm build` handles this automatically via workspace topology. Do not run per-package builds out of order.

## Code Standards

- **TypeScript everywhere.** All new code must be typed. Avoid `any`.
- **Zod for runtime validation.** Use Zod schemas at API boundaries and for configuration parsing.
- **Branded IDs.** All entity IDs use UUIDv7 with TypeScript branded types (`OrganizationId`, `ProjectId`, etc.). Cast with the appropriate `as*Id()` helper; do not use plain strings where a branded type is expected.
- **Row-level security.** Every transaction that touches tenant-scoped tables must call `setTenantContext(tx, organizationId)` before issuing queries. Without it, queries return zero rows (fail-closed by design).
- **AAA test structure.** Write tests in Arrange–Act–Assert order with a blank line separating each phase.
- **Comment the why, not the what.** Code comments should explain intent or non-obvious decisions, not restate what the code does.

## Licensing

SpecHive uses a dual-license model. By submitting a pull request, you agree to license your contribution under the applicable license:

| Contribution target                                                                                                                                | License  |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `apps/`, `packages/database`, `packages/nestjs-common`, `packages/api-types`                                                                       | AGPL-3.0 |
| `packages/playwright-reporter`, `packages/reporter-core-protocol`, `packages/shared-types`, `packages/eslint-config`, `packages/typescript-config` | MIT      |
