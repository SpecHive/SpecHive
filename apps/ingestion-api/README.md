# @spechive/ingestion-api

NestJS API for receiving test reporter events for [SpecHive](https://github.com/spechive-dev/spechive).

## Available modules

- **Ingestion** — receives and validates reporter events (run start, test results, artifacts)
- **Artifacts** — handles artifact upload via S3 presigned URLs

## Required infrastructure

- PostgreSQL 16+ with `spechive_app` role
- MinIO/S3-compatible storage
- Outboxy API (transactional outbox)

## Usage as a library

```typescript
import { IngestionModule } from '@spechive/ingestion-api/modules';
```

## License

[AGPL-3.0-only](./LICENSE)
