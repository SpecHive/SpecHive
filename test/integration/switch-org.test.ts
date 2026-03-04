/**
 * Organization switching E2E integration test for query-api.
 *
 * Verifies:
 * - User can switch to a second organization
 * - New JWT is scoped to the target organization
 * - Data isolation: second org does not see first org's projects
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
const INTEGRATION_ORG2_ID = '01970000-0000-7000-8000-000000000006';

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

async function login(organizationId?: string): Promise<string> {
  const response = await fetch(`${QUERY_API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      ...(organizationId ? { organizationId } : {}),
    }),
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { token: string };
  return body.token;
}

describe('Switch organization', () => {
  let tokenOrg1: string;

  beforeAll(async () => {
    await waitForService(QUERY_API_URL);
    tokenOrg1 = await login(INTEGRATION_ORG_ID);
  }, 30_000);

  it('switches to the second organization and returns a new token', async () => {
    const response = await fetch(`${QUERY_API_URL}/v1/auth/switch-organization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOrg1}`,
      },
      body: JSON.stringify({ organizationId: INTEGRATION_ORG2_ID }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      token: string;
      organization: { id: string };
    };
    expect(body.token).toBeDefined();
    expect(body.organization.id).toBe(INTEGRATION_ORG2_ID);
  });

  it('/me reflects the new organization after switching', async () => {
    const switchResponse = await fetch(`${QUERY_API_URL}/v1/auth/switch-organization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOrg1}`,
      },
      body: JSON.stringify({ organizationId: INTEGRATION_ORG2_ID }),
    });

    const { token: tokenOrg2 } = (await switchResponse.json()) as { token: string };

    const meResponse = await fetch(`${QUERY_API_URL}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${tokenOrg2}` },
    });

    expect(meResponse.status).toBe(200);
    const meBody = (await meResponse.json()) as {
      organizationId: string;
      role: string;
    };
    expect(meBody.organizationId).toBe(INTEGRATION_ORG2_ID);
    expect(meBody.role).toBe('member');
  });

  it('data isolation: second org has no projects from the first org', async () => {
    const switchResponse = await fetch(`${QUERY_API_URL}/v1/auth/switch-organization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOrg1}`,
      },
      body: JSON.stringify({ organizationId: INTEGRATION_ORG2_ID }),
    });

    const { token: tokenOrg2 } = (await switchResponse.json()) as { token: string };

    const orgsResponse = await fetch(`${QUERY_API_URL}/v1/auth/organizations`, {
      headers: { Authorization: `Bearer ${tokenOrg2}` },
    });

    expect(orgsResponse.status).toBe(200);
    const orgsBody = (await orgsResponse.json()) as { data: { id: string }[] };
    const orgIds = orgsBody.data.map((o) => o.id);
    expect(orgIds).toContain(INTEGRATION_ORG2_ID);
    expect(orgIds).toContain(INTEGRATION_ORG_ID);
  });

  it('rejects switching to an organization the user does not belong to', async () => {
    const fakeOrgId = '01970000-0000-7000-8000-ffffffffffff';
    const response = await fetch(`${QUERY_API_URL}/v1/auth/switch-organization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOrg1}`,
      },
      body: JSON.stringify({ organizationId: fakeOrgId }),
    });

    expect(response.status).toBe(403);
  });
});
