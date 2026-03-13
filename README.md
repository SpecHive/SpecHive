# SpecHive

Open-source test reporting platform for Playwright.

![CI](https://github.com/spechive-dev/spechive/actions/workflows/ci.yml/badge.svg) ![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg) [![npm](https://img.shields.io/npm/v/@spechive/playwright-reporter)](https://www.npmjs.com/package/@spechive/playwright-reporter)

## Features

- Multi-tenant with row-level security enforced at the database layer
- CQRS ingestion pipeline with transactional outbox for reliable event processing
- Playwright reporter published to npm — drop-in integration for any Playwright project
- S3-compatible artifact storage for screenshots, traces, and videos
- Test analytics dashboard with per-run and per-test history
- Team and organization management with member invitations
- Automatic artifact cleanup with configurable retention period
- CI auto-detection for GitHub Actions, GitLab CI, Jenkins, CircleCI, Azure DevOps, and more

## Architecture

```
Reporter ──▶ ingestion-api ──▶ Outboxy ──▶ worker
                  │                          │
                  ▼                          ▼
               PostgreSQL              MinIO (S3)
                  │
                  ▼
              query-api ──▶ dashboard
```

### Monorepo structure

```
apps/
  ingestion-api/   Receives test results from reporters (port 3000)
  worker/          Processes events from the transactional outbox (port 3001)
  query-api/       Serves data to the dashboard (port 3002)
  dashboard/       React/Vite SPA (port 5173)

packages/
  api-types/              Typed API response interfaces
  database/               Drizzle schema, migrations, seed
  eslint-config/          Shared ESLint config
  nestjs-common/          Shared NestJS modules
  playwright-reporter/    Playwright reporter for SpecHive
  reporter-core-protocol/ Protocol types for test reporters
  shared-types/           Branded ID types and enums
  typescript-config/      Shared tsconfig bases
```

## Quick Start (Development)

**Prerequisites:** Node.js >= 22, pnpm >= 9, Docker & Docker Compose.

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

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development guide, including workflow commands, commit conventions, and testing instructions.

> **Note:** `.env.example` contains safe defaults for local development. `.env.production` is the template for deployment with `CHANGE_ME` placeholders for all secrets.

## Self-Hosted Deployment

1. Clone the repository and copy the production environment template:

   ```bash
   git clone https://github.com/spechive-dev/spechive.git
   cd spechive
   cp .env.production .env
   ```

2. Fill in the required production secrets in `.env`:

   | Variable              | Description                                       |
   | --------------------- | ------------------------------------------------- |
   | `POSTGRES_PASSWORD`   | PostgreSQL superuser password                     |
   | `MINIO_ROOT_PASSWORD` | MinIO root password                               |
   | `WEBHOOK_SECRET`      | Outboxy webhook authentication key (min 32 chars) |
   | `TOKEN_HASH_KEY`      | Argon2 token hashing key (min 32 chars)           |
   | `JWT_SECRET`          | JWT signing key (min 64 chars)                    |

3. Start all services using the production compose file only (no dev override):

   ```bash
   docker compose up -d
   ```

4. Verify each service is ready:

   ```bash
   curl http://<host>:3000/health/ready   # ingestion-api
   curl http://<host>:3001/health/ready   # worker
   curl http://<host>:3002/health/ready   # query-api
   ```

5. Configure a reverse proxy (nginx, Caddy, etc.) for TLS termination and set the following variables for your domain:

   | Variable                | Description                                            |
   | ----------------------- | ------------------------------------------------------ |
   | `MINIO_PUBLIC_ENDPOINT` | Public CDN or proxy URL for presigned artifact URLs    |
   | `CORS_ORIGIN`           | Allowed origin for API CORS (your dashboard domain)    |
   | `VITE_API_URL`          | Query API URL inlined into the dashboard at build time |

   > `VITE_API_URL` is baked into the dashboard bundle at build time. Rebuild the dashboard image if you change the query-api URL.

All application containers run with a read-only filesystem, `cap_drop: ALL`, `no-new-privileges`, and as non-root users.

See `docs/deployment-checklist.md` for the full production checklist.

## Reporter Installation

```bash
npm install @spechive/playwright-reporter
```

Add it to your `playwright.config.ts`:

```typescript
// playwright.config.ts
export default defineConfig({
  reporter: [
    [
      '@spechive/playwright-reporter',
      {
        apiUrl: 'https://your-spechive-instance.com',
        projectToken: process.env.SPECHIVE_PROJECT_TOKEN,
      },
    ],
  ],
});
```

See [packages/playwright-reporter/README.md](packages/playwright-reporter/README.md) for the full configuration reference, CI setup examples, and troubleshooting guide.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, development workflow, and commit conventions.

## License

SpecHive uses a dual-license model:

| Component                                                                                                                                          | License                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `apps/`, `packages/database`, `packages/nestjs-common`, `packages/api-types`                                                                       | [AGPL-3.0](LICENSE)                                  |
| `packages/playwright-reporter`, `packages/reporter-core-protocol`, `packages/shared-types`, `packages/eslint-config`, `packages/typescript-config` | MIT (see individual `LICENSE` files in each package) |
