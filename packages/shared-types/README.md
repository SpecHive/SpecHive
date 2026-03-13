# @spechive/shared-types

Shared TypeScript types for the [SpecHive](https://github.com/spechive-dev/spechive) test reporting platform.

## What's included

- **Branded ID types** — `OrganizationId`, `ProjectId`, `RunId`, `SuiteId`, `TestId`, `ArtifactId`, `UserId`, `MembershipId`, `ProjectTokenId`, `TestAttemptId`, `InvitationId`
- **Type-safe casting helpers** — `asProjectId(str)`, `asRunId(str)`, etc.
- **Shared enums** — test status, run status, and other domain enums
- **Constants** — shared constants used across all packages

## Usage

```typescript
import { asProjectId, type ProjectId } from '@spechive/shared-types';

const id: ProjectId = asProjectId('0192f6a0-...');
```

All IDs use UUIDv7 and are branded at the type level to prevent accidental mixing of different entity IDs at compile time.

## License

[MIT](./LICENSE)
