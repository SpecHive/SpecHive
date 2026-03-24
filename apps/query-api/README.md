# @spechive/query-api

NestJS API serving dashboard read endpoints with JWT authentication for [SpecHive](https://github.com/spechive-dev/spechive).

## Available modules

- **Analytics** — run/test analytics and trends
- **Artifacts** — presigned URL generation for test artifacts
- **Auth** — JWT-based authentication (access + refresh tokens)
- **Invitations** — organization invitation management
- **Members** — organization membership
- **Projects** — project CRUD
- **Runs** — test run listing and detail
- **Suites** — test suite data
- **Tests** — test case results and attempts
- **Tokens** — project API token management

## Required infrastructure

- PostgreSQL 16+ with `spechive_app` role
- MinIO/S3-compatible storage

## Usage as a library

This package exports reusable modules for composition in downstream NestJS applications:

```typescript
import { RunsModule, TestsModule } from '@spechive/query-api/modules';
import { envSchema } from '@spechive/query-api/config';
```

## License

[AGPL-3.0-only](./LICENSE)
