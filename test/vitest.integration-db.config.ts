import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    pool: 'forks',
    maxWorkers: 1,
    // Only run tests that require Postgres (no live HTTP services needed).
    include: ['test/integration/rls-*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 35_000,
    reporters: ['tree'],
  },
});
