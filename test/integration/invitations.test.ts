/**
 * Invitations integration test for query-api.
 *
 * Verifies invitation lifecycle:
 * - Create, list, revoke, and validate invitations
 * - Role-based access control
 * - Token validation for public endpoints
 *
 * Requires the full Docker Compose stack running.
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

const TEST_IP = `10.inv.${randomBytes(4).toString('hex')}`;
const queryApi = new QueryApiClient(QUERY_API_URL);

describe('Invitations', () => {
  let ownerToken: string;

  beforeAll(async () => {
    await waitForService(QUERY_API_URL);
    ownerToken = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD, {
      organizationId: SEED_ORG_ID,
      forwardedIp: TEST_IP,
    });
  }, 30_000);

  it('creates an invitation and returns invite URL', async () => {
    const res = await queryApi.auth.requestRaw('POST', '/v1/invitations', {
      headers: { Authorization: `Bearer ${ownerToken}`, 'X-Forwarded-For': TEST_IP },
      body: { role: 'member' },
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      token: string;
      inviteUrl: string;
      role: string;
      email: string | null;
      expiresAt: string;
    };

    expect(body.id).toBeDefined();
    expect(body.token).toBeDefined();
    expect(body.inviteUrl).toContain('/register?invite=');
    expect(body.role).toBe('member');
    expect(body.email).toBeNull();
  });

  it('creates an invitation with email', async () => {
    const res = await queryApi.auth.requestRaw('POST', '/v1/invitations', {
      headers: { Authorization: `Bearer ${ownerToken}`, 'X-Forwarded-For': TEST_IP },
      body: { email: 'invited@example.com', role: 'member' },
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { email: string | null; role: string };
    expect(body.email).toBe('invited@example.com');
    expect(body.role).toBe('member');
  });

  it('rejects invitation with owner role', async () => {
    const res = await queryApi.auth.requestRaw('POST', '/v1/invitations', {
      headers: { Authorization: `Bearer ${ownerToken}`, 'X-Forwarded-For': TEST_IP },
      body: { role: 'owner' },
    });

    expect(res.status).toBe(400);
  });

  it('rejects invitation with admin role', async () => {
    const res = await queryApi.auth.requestRaw('POST', '/v1/invitations', {
      headers: { Authorization: `Bearer ${ownerToken}`, 'X-Forwarded-For': TEST_IP },
      body: { role: 'admin' },
    });

    expect(res.status).toBe(400);
  });

  it('validates a pending invitation token', async () => {
    // Create invitation
    const createRes = await queryApi.auth.requestRaw('POST', '/v1/invitations', {
      headers: { Authorization: `Bearer ${ownerToken}`, 'X-Forwarded-For': TEST_IP },
      body: { role: 'member' },
    });
    const { token } = (await createRes.json()) as { token: string };

    // Validate (public endpoint, no auth needed)
    const validateRes = await queryApi.auth.requestRaw('GET', `/v1/invitations/validate/${token}`, {
      headers: { 'X-Forwarded-For': TEST_IP },
    });

    expect(validateRes.status).toBe(200);
    const validation = (await validateRes.json()) as {
      valid: boolean;
      organizationName?: string;
      role?: string;
    };
    expect(validation.valid).toBe(true);
    expect(validation.organizationName).toBeDefined();
    expect(validation.role).toBe('member');
  });

  it('returns invalid for non-existent token', async () => {
    const validateRes = await queryApi.auth.requestRaw(
      'GET',
      '/v1/invitations/validate/nonexistent-token-value',
      { headers: { 'X-Forwarded-For': TEST_IP } },
    );

    expect(validateRes.status).toBe(200);
    const validation = (await validateRes.json()) as { valid: boolean };
    expect(validation.valid).toBe(false);
  });

  it('revokes an invitation and validate returns invalid', async () => {
    // Create invitation
    const createRes = await queryApi.auth.requestRaw('POST', '/v1/invitations', {
      headers: { Authorization: `Bearer ${ownerToken}`, 'X-Forwarded-For': TEST_IP },
      body: { role: 'viewer' },
    });
    const { id, token } = (await createRes.json()) as { id: string; token: string };

    // Revoke
    const revokeRes = await queryApi.auth.requestRaw('DELETE', `/v1/invitations/${id}`, {
      headers: { Authorization: `Bearer ${ownerToken}`, 'X-Forwarded-For': TEST_IP },
    });
    expect(revokeRes.status).toBe(204);

    // Validate should return invalid
    const validateRes = await queryApi.auth.requestRaw('GET', `/v1/invitations/validate/${token}`, {
      headers: { 'X-Forwarded-For': TEST_IP },
    });
    const validation = (await validateRes.json()) as { valid: boolean };
    expect(validation.valid).toBe(false);
  });

  it('lists invitations with status filter', async () => {
    const res = await queryApi.auth.requestRaw('GET', '/v1/invitations?status=pending', {
      headers: { Authorization: `Bearer ${ownerToken}`, 'X-Forwarded-For': TEST_IP },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ id: string; status: string }>;
      meta: { total: number };
    };
    expect(Array.isArray(body.data)).toBe(true);
    for (const inv of body.data) {
      expect(inv.status).toBe('pending');
    }
  });

  it('rejects create from non-admin user', async () => {
    // Register a new user (viewer role via invitation)
    const invRes = await queryApi.auth.requestRaw('POST', '/v1/invitations', {
      headers: { Authorization: `Bearer ${ownerToken}`, 'X-Forwarded-For': TEST_IP },
      body: { role: 'viewer' },
    });
    const { token: inviteToken } = (await invRes.json()) as { token: string };

    const viewerEmail = `viewer-${randomBytes(4).toString('hex')}@test.dev`;
    const regRes = await queryApi.auth.register(
      {
        email: viewerEmail,
        password: 'password123',
        name: 'Viewer User',
        inviteToken,
      },
      TEST_IP,
    );
    expect(regRes.status).toBe(201);

    // Try to create invitation as viewer
    const createRes = await queryApi.auth.requestRaw('POST', '/v1/invitations', {
      headers: { Authorization: `Bearer ${regRes.body.token}`, 'X-Forwarded-For': TEST_IP },
      body: { role: 'member' },
    });
    expect(createRes.status).toBe(403);
  });
});
