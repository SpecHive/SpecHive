/**
 * Rate limiting integration test (FIX-010).
 *
 * Verifies the login endpoint enforces its per-IP rate limit
 * via the ThrottlerBehindProxyGuard using X-Forwarded-For.
 */

import { randomBytes } from 'node:crypto';

import { describe, it, expect, beforeAll } from 'vitest';

const QUERY_API_URL = process.env['QUERY_API_URL'] ?? 'http://localhost:3002';

async function waitForService(url: string, maxAttempts = 20, delayMs = 500): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      // Service not yet ready
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Service at ${url} did not become ready within ${maxAttempts * delayMs}ms`);
}

describe('Rate limiting on login endpoint', () => {
  // Unique per test run to avoid stale throttle state from prior runs
  const TEST_IP = `10.rate.limit.${randomBytes(4).toString('hex')}`;

  beforeAll(async () => {
    await waitForService(QUERY_API_URL);
  }, 30_000);

  it('allows 10 requests then returns 429 on the 11th', async () => {
    const statuses: number[] = [];

    // Send 11 requests sequentially for deterministic ordering
    for (let i = 0; i < 11; i++) {
      const res = await fetch(`${QUERY_API_URL}/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': TEST_IP,
        },
        body: JSON.stringify({
          email: 'rate-limit-test@example.com',
          password: 'wrong-password',
        }),
      });
      statuses.push(res.status);
    }

    // First 10 should be 401 (invalid creds), not 429
    for (let i = 0; i < 10; i++) {
      expect(statuses[i]).toBe(401);
    }

    // 11th should be 429 (rate limited)
    expect(statuses[10]).toBe(429);
  }, 30_000);
});
