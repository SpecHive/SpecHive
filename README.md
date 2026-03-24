# SpecHive

Open-source test reporting platform for Playwright.

![CI](https://github.com/SpecHive/SpecHive/actions/workflows/ci.yml/badge.svg) ![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg) [![npm](https://img.shields.io/npm/v/@spechive/playwright-reporter)](https://www.npmjs.com/package/@spechive/playwright-reporter)

See every test failure. Track flaky tests. Ship with confidence. Simple to deploy — a single `docker compose up` with no JVM or complex setup required.

[spechive.dev](https://spechive.dev) | [Try SpecHive Cloud](https://app.spechive.dev) | [Documentation](https://spechive.dev/blog/setting-up-playwright-test-reporting-in-5-minutes)

![SpecHive Dashboard](https://spechive.dev/images/dashboard-overview.png)

## Why SpecHive?

- **One install, results flow automatically.** Add a single reporter package to your Playwright config — no servers to configure, no plugins to wire up.
- **Self-hosted or cloud — you choose where data lives.** Same reporter, same dashboard. The only difference is the `apiUrl`.
- **Flaky test detection and trend analytics built in.** Track pass rates, durations, and flaky patterns across runs without a separate BI tool.
- **Artifacts attached to failures, not buried in CI logs.** Screenshots, traces, and videos linked directly to each failed test.

## Quick Start — Cloud

The fastest way to get started. Create a project, copy your token, and results start flowing in minutes. Free tier includes 5,000 test results per month — no credit card required.

[Get started free](https://app.spechive.dev)

**1. Install the reporter**

```bash
npm install -D @spechive/playwright-reporter
```

**2. Add to your Playwright config**

```typescript
// playwright.config.ts
export default defineConfig({
  reporter: [
    ['html'],
    [
      '@spechive/playwright-reporter',
      {
        projectToken: process.env.SPECHIVE_PROJECT_TOKEN,
      },
    ],
  ],
});
```

**3. Run your tests**

```bash
npx playwright test
```

That's it. Results appear in your dashboard within seconds.

See [packages/playwright-reporter/README.md](packages/playwright-reporter/README.md) for the full configuration reference, CI setup examples, and troubleshooting guide.

## Quick Start — Self-Hosted

Clone the repository and start the stack:

```bash
git clone https://github.com/SpecHive/SpecHive.git
cd spechive
cp .env.example .env
# Fill in the required secrets in .env
docker compose up -d
```

Point the reporter at your instance by adding `apiUrl` to the config:

```typescript
[
  '@spechive/playwright-reporter',
  {
    apiUrl: 'https://your-spechive-instance.com',
    projectToken: process.env.SPECHIVE_PROJECT_TOKEN,
  },
];
```

See [docs/deployment-checklist.md](docs/deployment-checklist.md) for the full production deployment guide.

## Features

- **Full run history** — every pass, fail, and flaky result in one place with drill-down to individual attempts
- **Flaky test detection** — automatically flags tests that flip between pass and fail across runs
- **Trend analytics** — pass rate and duration trends per project, suite, and individual test
- **Screenshots, traces, and videos on every failure** — artifacts attached directly to test results, not lost in CI logs
- **Works out of the box with major CI providers** — GitHub Actions, GitLab CI, Jenkins, CircleCI, Azure DevOps, and more
- **Team management and role-based access** — multi-tenant with organization-scoped data isolation
- **Automatic artifact cleanup** — configurable retention periods keep storage costs predictable

## Architecture

```
                        ┌─────────────────────────────────┐
Reporter ──▶            │           gateway                │
                        │  (JWT auth · rate limiting)      │
dashboard ◀──▶          └──────┬──────────────┬────────────┘
                               │              │
                               ▼              ▼
                        ingestion-api    query-api
                               │              │
                               ▼              ▼
                           PostgreSQL ◀───────┘
                               │
                            Outboxy
                               │
                               ▼
                            worker ──▶ MinIO (S3)
```

The **gateway** is the single external entry point — reporters and the dashboard connect only to it. Internal services are not exposed.

### Monorepo structure

```
apps/
  gateway/         API gateway — JWT auth, rate limiting, routing (port 3003)
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

## Community

- [GitHub Discussions](https://github.com/orgs/spechive-dev/discussions) — questions, ideas, and show-and-tell
- [Issue tracker](https://github.com/SpecHive/SpecHive/issues) — bug reports and feature requests

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, development workflow, and commit conventions.

## License

SpecHive uses a dual-license model:

| Component                                                                                                                                          | License                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `apps/`, `packages/database`, `packages/nestjs-common`, `packages/api-types`                                                                       | [AGPL-3.0](LICENSE)                                  |
| `packages/playwright-reporter`, `packages/reporter-core-protocol`, `packages/shared-types`, `packages/eslint-config`, `packages/typescript-config` | MIT (see individual `LICENSE` files in each package) |
