# @assertly/api-types

Typed API response interfaces for the [Assertly](https://github.com/assertly-dev/assertly) query API.

## What's included

- **Response types** — typed interfaces for all query API responses
- **Pagination types** — cursor-based pagination helpers

## Usage

```typescript
import type { PaginatedResponse } from '@assertly/api-types';
```

These types are shared between the query API (producer) and the dashboard (consumer) to ensure type safety across the stack.

## License

[AGPL-3.0-only](./LICENSE)
