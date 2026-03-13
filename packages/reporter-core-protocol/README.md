# @assertly/reporter-core-protocol

Core event protocol definitions for [Assertly](https://github.com/assertly-dev/assertly) test reporters.

## What's included

- **Event types** — typed definitions for all reporter-to-server events (run start, suite start, test result, artifact upload, etc.)
- **Zod schemas** — runtime validation schemas for each event type
- **Wire protocol envelope** — the `ReporterEnvelope` wrapper that carries event payloads with version and metadata

## Usage

```typescript
import { RunStartEventSchema, type RunStartEvent } from '@assertly/reporter-core-protocol';

// Validate incoming event
const event = RunStartEventSchema.parse(rawPayload);
```

## Wire protocol

Events are sent as JSON payloads wrapped in a versioned envelope. The protocol is designed for forward compatibility — unknown event types are ignored by the server.

## License

[MIT](./LICENSE)
