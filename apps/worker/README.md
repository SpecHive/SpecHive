# @assertly/worker

NestJS worker for processing outbox events for [Assertly](https://github.com/assertly-dev/assertly).

## Available modules

- **Result Processor** — processes test results from ingestion events
- **Webhook Receiver** — receives Outboxy webhook deliveries
- **Artifact Cleanup** — scheduled cleanup of orphaned artifacts
- **Run Cleanup** — scheduled cleanup of stale pending runs

## Required infrastructure

- PostgreSQL 16+ with `assertly_app` role
- MinIO/S3-compatible storage
- Outboxy API (transactional outbox)

## Usage as a library

```typescript
import { ResultProcessorModule } from '@assertly/worker/modules';
import { envSchema } from '@assertly/worker/config';
```

## License

[AGPL-3.0-only](./LICENSE)
