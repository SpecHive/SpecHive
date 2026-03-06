import { defineConfig } from 'vitest/config';

import { parseDotEnv } from './helpers/load-dot-env';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    env: parseDotEnv(),
    globalSetup: ['test/integration-global-setup.ts'],
    // Run integration tests sequentially to avoid port conflicts and to keep
    // failure output readable.
    pool: 'forks',
    maxWorkers: 1,
    include: ['test/integration/**/*.test.ts'],
    // Integration tests call live HTTP services, so they need longer timeouts.
    testTimeout: 30_000,
    hookTimeout: 35_000,
    reporters: ['tree'],
  },
});
