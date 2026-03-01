# @assertly/playwright-reporter

Playwright reporter for the Assertly test reporting platform.

## Installation

```bash
pnpm add -D @assertly/playwright-reporter
```

## Usage

Add the reporter to your `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    [
      '@assertly/playwright-reporter',
      {
        apiUrl: 'https://api.assertly.dev',
        projectToken: process.env.ASSERTLY_PROJECT_TOKEN,
      },
    ],
  ],
});
```

## Configuration

| Option         | Type      | Required | Default | Description                          |
| -------------- | --------- | -------- | ------- | ------------------------------------ |
| `apiUrl`       | `string`  | Yes      | -       | Assertly API endpoint                |
| `projectToken` | `string`  | Yes      | -       | Project token for authentication     |
| `batchSize`    | `number`  | No       | `100`   | Number of events to batch per upload |
| `timeout`      | `number`  | No       | `30000` | HTTP request timeout in ms           |
| `enabled`      | `boolean` | No       | `true`  | Enable/disable reporter              |

## License

MIT
