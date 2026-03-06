/**
 * Auth flow E2E integration test for query-api.
 *
 * Verifies JWT authentication:
 * - Unauthenticated requests are rejected (401)
 * - Login returns a valid JWT
 * - Protected endpoints accept valid JWT (200)
 * - Invalid/malformed JWTs are rejected (401)
 *
 * Requires the full Docker Compose stack running:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
 *
 * Run with:
 *   pnpm test:integration
 */

import { randomBytes } from 'node:crypto';

import { describe, it, expect, beforeAll } from 'vitest';

import {
  waitForService,
  QueryApiClient,
  QUERY_API_URL,
  SEED_ORG_ID,
  SEED_EMAIL,
  SEED_PASSWORD,
} from '../helpers';

// Unique per test run to avoid stale throttle state from prior runs
const TEST_IP = `10.auth.flow.${randomBytes(4).toString('hex')}`;

const queryApi = new QueryApiClient(QUERY_API_URL);

describe('Auth flow', () => {
  beforeAll(async () => {
    await waitForService(QUERY_API_URL);
  }, 30_000);

  it('rejects unauthenticated requests to protected endpoints (401)', async () => {
    // Raw fetch: need to send request with no Authorization header at all
    const response = await queryApi.auth.requestRaw('GET', '/v1/auth/me', {
      headers: { 'X-Forwarded-For': TEST_IP },
    });
    expect(response.status).toBe(401);
  });

  it('rejects requests with malformed Authorization header (401)', async () => {
    // Raw fetch: need to send a malformed Authorization header
    const response = await queryApi.auth.requestRaw('GET', '/v1/auth/me', {
      headers: { Authorization: 'InvalidFormat', 'X-Forwarded-For': TEST_IP },
    });
    expect(response.status).toBe(401);
  });

  it('rejects requests with invalid JWT (401)', async () => {
    // Raw fetch: need to send an invalid Bearer token
    const response = await queryApi.auth.requestRaw('GET', '/v1/auth/me', {
      headers: { Authorization: 'Bearer invalid.jwt.token', 'X-Forwarded-For': TEST_IP },
    });
    expect(response.status).toBe(401);
  });

  it('login returns JWT for valid credentials', async () => {
    const { status, body } = await queryApi.auth.login(SEED_EMAIL, SEED_PASSWORD, {
      organizationId: SEED_ORG_ID,
      forwardedIp: TEST_IP,
    });

    expect(status).toBe(200);
    expect(body).toHaveProperty('token');
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);
  });

  it('login fails with invalid credentials (401)', async () => {
    const { status } = await queryApi.auth.login(SEED_EMAIL, 'wrong-password', {
      organizationId: SEED_ORG_ID,
      forwardedIp: TEST_IP,
    });

    expect(status).toBe(401);
  });

  it('allows access to protected endpoints with valid JWT (200)', async () => {
    const token = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD, {
      organizationId: SEED_ORG_ID,
      forwardedIp: TEST_IP,
    });

    const { status, body: meBody } = await queryApi.auth.me(token, TEST_IP);

    expect(status).toBe(200);
    expect(meBody.email).toBe(SEED_EMAIL);
    expect(meBody.organizationId).toBe(SEED_ORG_ID);
    expect(meBody.role).toBe('owner');
  });
});
