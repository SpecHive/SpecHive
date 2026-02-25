import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
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
