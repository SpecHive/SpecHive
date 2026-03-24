# @spechive/api-types

Typed API response interfaces for the [SpecHive](https://github.com/spechive-dev/spechive) query API.

## What's included

- **Response types** — typed interfaces for all query API responses
- **Pagination types** — cursor-based pagination helpers

## Usage

```typescript
import type { PaginatedResponse } from '@spechive/api-types';
```

These types are shared between the query API (producer) and the dashboard (consumer) to ensure type safety across the stack.

## License

[AGPL-3.0-only](./LICENSE)
