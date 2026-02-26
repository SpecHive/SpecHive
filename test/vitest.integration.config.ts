import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

function loadDotEnv(): Record<string, string> {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
    const env: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
    return env;
  } catch {
    return {};
  }
}

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    env: loadDotEnv(),
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
