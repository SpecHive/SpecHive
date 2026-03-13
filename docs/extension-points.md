# Extension Points

SpecHive's apps and packages are designed for composition — a downstream repo (e.g. a SaaS layer) can import OSS modules, override guards, extend config, and inject dashboard plugins.

## Backend: Module Composition

Each NestJS app re-exports its feature modules via a `./modules` subpath. A downstream repo creates its own `AppModule` that imports these alongside premium modules.

| Subpath                           | Modules                                                                                                                                             | Source                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `@spechive/query-api/modules`     | AnalyticsModule, ArtifactsModule, AuthModule, InvitationsModule, MembersModule, ProjectsModule, RunsModule, SuitesModule, TestsModule, TokensModule | `apps/query-api/src/modules/index.ts`     |
| `@spechive/ingestion-api/modules` | ArtifactsModule, IngestionModule                                                                                                                    | `apps/ingestion-api/src/modules/index.ts` |
| `@spechive/worker/modules`        | ArtifactCleanupModule, ResultProcessorModule, RunCleanupModule, WebhookReceiverModule                                                               | `apps/worker/src/modules/index.ts`        |

Each barrel file documents the required dependencies (DatabaseModule, S3Module, ConfigService keys, etc.) via JSDoc.

### Extension patterns

- **Guard override**: Register a custom `APP_GUARD` in your `AppModule` to replace `JwtAuthGuard`. OSS modules read `request.user` — both guards must populate the same `UserContext` shape.
- **Config injection**: Use `createConfigModule()` from `@spechive/nestjs-common` with an extended Zod schema to provide premium env vars alongside the base config.
- **Service extension**: Use NestJS interceptors to wrap behavior (preferred), or extend a service class directly after adding it to the barrel export.

## Frontend: Dashboard Plugin System

The `App` component accepts an optional `plugins` prop. See `apps/dashboard/src/lib/plugin-registry.tsx` for the full `DashboardPlugin` interface.

Plugins can provide:

- **Routes** (`layout: 'app'` or `layout: 'settings'`) — lazy-loaded, wrapped in `<Suspense>`
- **Nav items** — appended to the sidebar after core navigation
- **Settings nav items** — appended to the settings sub-nav after core items

Zero plugins = identical behavior to the standalone OSS dashboard.
