# @spechive/worker

NestJS worker for processing outbox events for [SpecHive](https://github.com/spechive-dev/spechive).

## Available modules

- **Result Processor** — processes test results from ingestion events
- **Webhook Receiver** — receives Outboxy webhook deliveries
- **Artifact Cleanup** — scheduled cleanup of orphaned artifacts
- **Run Cleanup** — scheduled cleanup of stale pending runs

## Required infrastructure

- PostgreSQL 16+ with `spechive_app` role
- MinIO/S3-compatible storage
- Outboxy API (transactional outbox)

## Usage as a library

```typescript
import { ResultProcessorModule } from '@spechive/worker/modules';
import { envSchema } from '@spechive/worker/config';
```

## License

[AGPL-3.0-only](./LICENSE)
