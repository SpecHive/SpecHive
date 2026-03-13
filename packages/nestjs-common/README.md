# @spechive/nestjs-common

Shared NestJS modules and utilities for [SpecHive](https://github.com/spechive-dev/spechive) backend services.

## Exported modules

| Module               | Purpose                                    |
| -------------------- | ------------------------------------------ |
| `DatabaseModule`     | Drizzle ORM connection with tenant context |
| `HealthModule`       | Health check endpoints (`/health/ready`)   |
| `S3Module`           | S3/MinIO client with presigned URL support |
| `IsProductionModule` | `IS_PRODUCTION` injection token            |

## Exported utilities

- `bootstrapNestApp()` — standard Fastify-based NestJS bootstrap with helmet, CORS, and global pipes
- `createConfigModule()` — typed config module factory with Zod validation
- `AllExceptionsFilter` — global exception filter
- `JwtAuthGuard`, `RolesGuard`, `Public`, `Roles` — JWT authentication and RBAC
- `ZodValidationPipe` — request validation via Zod schemas
- `ThrottlerBehindProxyGuard` — rate limiting aware of `X-Forwarded-For`
- `createOutboxyAdapter()` — Outboxy transactional outbox integration

## Usage

```typescript
import { DatabaseModule, HealthModule, S3Module } from '@spechive/nestjs-common';

@Module({
  imports: [DatabaseModule, HealthModule, S3Module],
})
export class AppModule {}
```

## License

[AGPL-3.0-only](./LICENSE)
