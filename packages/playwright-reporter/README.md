# @assertly/playwright-reporter

Playwright reporter for the [Assertly](https://github.com/assertly-dev/assertly) test reporting platform. Sends test results, retries, and artifacts (screenshots, traces, videos) to your Assertly instance in real time.

## Installation

```bash
pnpm add -D @assertly/playwright-reporter
```

## Configuration

Add the reporter to your `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['html'],
    [
      '@assertly/playwright-reporter',
      {
        apiUrl: 'https://api.your-assertly-instance.com',
        projectToken: process.env.ASSERTLY_PROJECT_TOKEN,
        captureArtifacts: true,
        failOnConnectionError: false,
      },
    ],
  ],
});
```

### Config Options

| Option                  | Type                      | Default                      | Description                                              |
| ----------------------- | ------------------------- | ---------------------------- | -------------------------------------------------------- |
| `apiUrl`                | `string`                  | `ASSERTLY_API_URL` env       | Assertly API endpoint                                    |
| `projectToken`          | `string`                  | `ASSERTLY_PROJECT_TOKEN` env | Project token for authentication                         |
| `timeout`               | `number`                  | `30000`                      | HTTP request timeout in milliseconds                     |
| `enabled`               | `boolean`                 | `true`                       | Enable or disable the reporter                           |
| `captureArtifacts`      | `boolean`                 | `true`                       | Upload test artifacts (screenshots, traces, videos)      |
| `maxRetries`            | `number`                  | `3`                          | Max retries for failed API calls                         |
| `flushTimeout`          | `number`                  | `30000`                      | Max wait time for pending events on test completion (ms) |
| `failOnConnectionError` | `boolean`                 | `false`                      | Throw if the API is unreachable instead of warning       |
| `metadata`              | `Record<string, unknown>` | `{}`                         | Custom metadata to attach to the run                     |

## Environment Variables

| Variable                 | Description                                        |
| ------------------------ | -------------------------------------------------- |
| `ASSERTLY_API_URL`       | Fallback for `apiUrl` when not set in config       |
| `ASSERTLY_PROJECT_TOKEN` | Fallback for `projectToken` when not set in config |
| `ASSERTLY_ENABLED`       | Set to `"false"` or `"0"` to disable the reporter  |

Config values take precedence over environment variables.

## CI Auto-Detection

The reporter automatically detects CI environments and attaches branch name, commit SHA, CI build URL, and provider name to each run. Supported providers:

- GitHub Actions
- GitLab CI
- Jenkins
- CircleCI
- Azure DevOps
- Generic CI (falls back to common environment variables like `CI_COMMIT_SHA`, `BUILD_URL`)

No configuration is needed -- CI metadata is collected automatically when running inside a supported CI environment.

## CI Setup Examples

### GitHub Actions

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
        env:
          ASSERTLY_API_URL: ${{ vars.ASSERTLY_API_URL }}
          ASSERTLY_PROJECT_TOKEN: ${{ secrets.ASSERTLY_PROJECT_TOKEN }}
```

### GitLab CI

```yaml
e2e-tests:
  image: mcr.microsoft.com/playwright:v1.50.0-noble
  variables:
    ASSERTLY_API_URL: $ASSERTLY_API_URL
    ASSERTLY_PROJECT_TOKEN: $ASSERTLY_PROJECT_TOKEN
  script:
    - npm ci
    - npx playwright test
```

## Troubleshooting

**Reporter disabled warning**
If you see `[assertly] Reporter disabled: missing apiUrl or projectToken`, ensure that `ASSERTLY_API_URL` and `ASSERTLY_PROJECT_TOKEN` environment variables are set, or pass `apiUrl` and `projectToken` directly in the reporter config.

**Connection errors**
If the reporter cannot reach your Assertly instance, verify the `apiUrl` is correct and the server is reachable. Set `failOnConnectionError: true` to make the test run fail immediately when the API is unreachable, instead of silently dropping events.

**Missing artifacts**
Verify that `captureArtifacts` is not set to `false`. Artifacts larger than 10 MB are skipped automatically. Check the console output for `[assertly] Skipping artifact` warnings.

## License

[MIT](./LICENSE)
