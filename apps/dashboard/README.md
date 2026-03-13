# @spechive/dashboard

React dashboard UI for the [SpecHive](https://github.com/spechive-dev/spechive) test reporting platform.

## Standalone app

```bash
pnpm dev      # Vite dev server on :5173
pnpm build    # Production build (app + lib)
```

## Library usage

The dashboard is also published as a component library for use in downstream applications (e.g., `@spechive-cloud/cloud-dashboard`):

```typescript
import { DashboardApp } from '@spechive/dashboard';
import '@spechive/dashboard/style.css';
```

### Exports

| Export        | Content                                    |
| ------------- | ------------------------------------------ |
| `.`           | Main dashboard components and plugin API   |
| `./style.css` | Required CSS (Tailwind + component styles) |

## Tech stack

- React 19 + React Router 7
- Tailwind CSS 4
- Recharts (analytics charts)
- Radix UI primitives

## License

[AGPL-3.0-only](./LICENSE)
