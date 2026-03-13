/**
 * Registration flow integration test for query-api.
 *
 * Requires the full Docker Compose stack running:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
 *
 * Run with:
 *   pnpm test:integration
 */

import { randomBytes } from 'node:crypto';

import { describe, it, expect, beforeAll } from 'vitest';

import { waitForService, QueryApiClient, QUERY_API_URL } from '../helpers';

const queryApi = new QueryApiClient(QUERY_API_URL);

function uniqueEmail() {
  return `reg-${randomBytes(4).toString('hex')}@test.spechive.dev`;
}

describe('Registration', () => {
  beforeAll(async () => {
    await waitForService(QUERY_API_URL);
  }, 30_000);

  it('registers a new user and returns token, user, and organization (201)', async () => {
    const email = uniqueEmail();
    const { status, body, refreshCookie } = await queryApi.auth.register({
      email,
      password: 'securepass1',
      name: 'New User',
      organizationName: 'New Org',
    });

    expect(status).toBe(201);
    expect(body.token).toBeDefined();
    expect(refreshCookie).toBeDefined();
    expect(body.user?.email).toBe(email);
    expect(body.user?.name).toBe('New User');
    expect(body.organization?.name).toBe('New Org');
    expect(body.organization?.slug).toBe('new-org');
  });

  it('registered user can access GET /v1/auth/me', async () => {
    const email = uniqueEmail();
    const { body: regBody } = await queryApi.auth.register({
      email,
      password: 'securepass1',
      name: 'Auth Test',
      organizationName: 'Auth Org',
    });

    const { status, body: meBody } = await queryApi.auth.me(regBody.token);

    expect(status).toBe(200);
    expect(meBody.email).toBe(email);
    expect(meBody.role).toBe('owner');
  });

  it('rejects duplicate email (409)', async () => {
    const email = uniqueEmail();
    await queryApi.auth.register({
      email,
      password: 'securepass1',
      name: 'First',
      organizationName: 'Org A',
    });

    const { status, body } = await queryApi.auth.register({
      email,
      password: 'securepass1',
      name: 'Second',
      organizationName: 'Org B',
    });

    expect(status).toBe(409);
    expect((body as { message?: string }).message).toContain('email');
  });

  it('rejects short password (400)', async () => {
    const { status } = await queryApi.auth.register({
      email: uniqueEmail(),
      password: 'short',
      name: 'Test',
      organizationName: 'Org',
    });

    expect(status).toBe(400);
  });

  it('rejects missing required fields (400)', async () => {
    const { status } = await queryApi.auth.register({
      email: '',
      password: 'securepass1',
      name: 'Test',
      organizationName: 'Org',
    });

    expect(status).toBe(400);
  });

  describe('RLS scoping', () => {
    it('registered user only sees their own projects', async () => {
      const email = uniqueEmail();
      const { body: regBody } = await queryApi.auth.register({
        email,
        password: 'securepass1',
        name: 'RLS Test',
        organizationName: 'RLS Org',
      });

      // Create a project for the new user
      const createRes = await queryApi.auth.requestRaw('POST', '/v1/projects', {
        headers: {
          Authorization: `Bearer ${regBody.token}`,
          'Content-Type': 'application/json',
        },
        body: { name: 'My RLS Project' },
      });
      expect(createRes.status).toBe(201);

      // List projects — should only see own project
      const listRes = await queryApi.auth.request<{ data: { name: string }[] }>(
        'GET',
        '/v1/projects',
        {
          headers: {
            Authorization: `Bearer ${regBody.token}`,
          },
        },
      );

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0]!.name).toBe('My RLS Project');
    });
  });
});
