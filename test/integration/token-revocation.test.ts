/**
 * Token revocation integration test.
 *
 * Verifies the full lifecycle:
 * 1. Login → get JWT
 * 2. Create project via POST /v1/projects
 * 3. Create token via POST /v1/projects/:id/tokens → get plain-text token
 * 4. Authenticate against ingestion-api with token → expect success
 * 5. Revoke token via DELETE /v1/projects/:id/tokens/:tokenId
 * 6. Authenticate against ingestion-api with revoked token → expect 401
 *
 * Requires the full Docker Compose stack running.
 */

import { randomBytes } from 'node:crypto';

import { describe, it, expect, beforeAll } from 'vitest';

const QUERY_API_URL = process.env['QUERY_API_URL'] ?? 'http://localhost:3002';
const INGESTION_API_URL = process.env['INGESTION_API_URL'] ?? 'http://localhost:3000';
const TEST_USER_EMAIL = 'test-user@assertly.dev';
const TEST_USER_PASSWORD = 'test-password';
const INTEGRATION_ORG_ID = '01970000-0000-7000-8000-000000000001';

const TEST_IP = `10.tok.rev.${randomBytes(4).toString('hex')}`;

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

async function login(): Promise<string> {
  const response = await fetch(`${QUERY_API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': TEST_IP },
    body: JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      organizationId: INTEGRATION_ORG_ID,
    }),
  });

  expect(response.status).toBe(200);
  const body = (await response.json()) as { token: string };
  return body.token;
}

describe('Token revocation', () => {
  let jwt: string;

  beforeAll(async () => {
    await Promise.all([waitForService(QUERY_API_URL), waitForService(INGESTION_API_URL)]);
    jwt = await login();
  }, 30_000);

  it('revoked token is rejected by ingestion-api', async () => {
    const projectName = `RevocationTest-${randomBytes(4).toString('hex')}`;

    // 1. Create project
    const createProjectRes = await fetch(`${QUERY_API_URL}/v1/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        'X-Forwarded-For': TEST_IP,
      },
      body: JSON.stringify({ name: projectName }),
    });

    expect(createProjectRes.status).toBe(201);
    const project = (await createProjectRes.json()) as { id: string };

    // 2. Create token
    const createTokenRes = await fetch(`${QUERY_API_URL}/v1/projects/${project.id}/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        'X-Forwarded-For': TEST_IP,
      },
      body: JSON.stringify({ name: 'Revocation Test Token' }),
    });

    expect(createTokenRes.status).toBe(201);
    const tokenBody = (await createTokenRes.json()) as { id: string; token: string };
    const plainToken = tokenBody.token;
    const tokenId = tokenBody.id;

    // 3. Verify token works against ingestion-api
    const ingestRes = await fetch(`${INGESTION_API_URL}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-project-token': plainToken,
        'X-Forwarded-For': TEST_IP,
      },
      body: JSON.stringify({ type: 'run:started', payload: {} }),
    });
    // We expect the guard to pass (not 401) — the endpoint may return 400/422 for invalid payload
    expect(ingestRes.status).not.toBe(401);

    // 4. Revoke token
    const revokeRes = await fetch(`${QUERY_API_URL}/v1/projects/${project.id}/tokens/${tokenId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'X-Forwarded-For': TEST_IP,
      },
    });

    expect(revokeRes.status).toBe(204);

    // 5. Verify revoked token is rejected by ingestion-api
    const revokedIngestRes = await fetch(`${INGESTION_API_URL}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-project-token': plainToken,
        'X-Forwarded-For': TEST_IP,
      },
      body: JSON.stringify({ type: 'run:started', payload: {} }),
    });

    expect(revokedIngestRes.status).toBe(401);
  });
});
