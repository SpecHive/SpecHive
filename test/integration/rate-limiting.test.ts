/**
 * Rate limiting integration test (FIX-010).
 *
 * Verifies the login endpoint enforces its per-IP rate limit
 * via the gateway's ThrottlerBehindProxyGuard using X-Forwarded-For.
 */

import { randomBytes } from 'node:crypto';

import { describe, it, expect, beforeAll } from 'vitest';

import { waitForService, QueryApiClient, GATEWAY_URL } from '../helpers';

const queryApi = new QueryApiClient(GATEWAY_URL);

describe('Rate limiting on login endpoint', () => {
  // Unique per test run to avoid stale throttle state from prior runs
  const TEST_IP = `10.rate.limit.${randomBytes(4).toString('hex')}`;

  beforeAll(async () => {
    await waitForService(GATEWAY_URL);
  }, 30_000);

  it('allows 10 requests then returns 429 on the 11th', async () => {
    const statuses: number[] = [];

    // Send 11 requests sequentially for deterministic ordering
    for (let i = 0; i < 11; i++) {
      const res = await queryApi.auth.loginRaw('rate-limit-test@example.com', 'wrong-password', {
        forwardedIp: TEST_IP,
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
