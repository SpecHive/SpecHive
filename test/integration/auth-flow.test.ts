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

import { describe, it, expect, beforeAll } from 'vitest';

const QUERY_API_URL = process.env['QUERY_API_URL'] ?? 'http://localhost:3002';
const TEST_USER_EMAIL = 'test-user@assertly.dev';
const TEST_USER_PASSWORD = 'test-password';
const INTEGRATION_ORG_ID = '01970000-0000-7000-8000-000000000001';

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

describe('Auth flow', () => {
  beforeAll(async () => {
    await waitForService(QUERY_API_URL);
  }, 30_000);

  it('rejects unauthenticated requests to protected endpoints (401)', async () => {
    const response = await fetch(`${QUERY_API_URL}/v1/auth/me`);
    expect(response.status).toBe(401);
  });

  it('rejects requests with malformed Authorization header (401)', async () => {
    const response = await fetch(`${QUERY_API_URL}/v1/auth/me`, {
      headers: { Authorization: 'InvalidFormat' },
    });
    expect(response.status).toBe(401);
  });

  it('rejects requests with invalid JWT (401)', async () => {
    const response = await fetch(`${QUERY_API_URL}/v1/auth/me`, {
      headers: { Authorization: 'Bearer invalid.jwt.token' },
    });
    expect(response.status).toBe(401);
  });

  it('login returns JWT for valid credentials', async () => {
    const response = await fetch(`${QUERY_API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        organizationId: INTEGRATION_ORG_ID,
      }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { accessToken?: string };
    expect(body).toHaveProperty('accessToken');
    expect(typeof body.accessToken).toBe('string');
    expect(body.accessToken!.length).toBeGreaterThan(0);
  });

  it('login fails with invalid credentials (401)', async () => {
    const response = await fetch(`${QUERY_API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: 'wrong-password',
        organizationId: INTEGRATION_ORG_ID,
      }),
    });

    expect(response.status).toBe(401);
  });

  it('allows access to protected endpoints with valid JWT (200)', async () => {
    // First, login to get a valid JWT
    const loginResponse = await fetch(`${QUERY_API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        organizationId: INTEGRATION_ORG_ID,
      }),
    });

    expect(loginResponse.status).toBe(201);
    const loginBody = (await loginResponse.json()) as { accessToken: string };
    const token = loginBody.accessToken;

    // Now access a protected endpoint
    const meResponse = await fetch(`${QUERY_API_URL}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(meResponse.status).toBe(200);
    const meBody = (await meResponse.json()) as {
      id: string;
      email: string;
      organizationId: string;
      role: string;
    };
    expect(meBody.email).toBe(TEST_USER_EMAIL);
    expect(meBody.organizationId).toBe(INTEGRATION_ORG_ID);
    expect(meBody.role).toBe('owner');
  });
});
