import { randomBytes } from 'node:crypto';

import { describe, it, expect, beforeAll } from 'vitest';

import {
  waitForService,
  QueryApiClient,
  GATEWAY_URL,
  SEED_ORG_ID,
  SEED_EMAIL,
  SEED_PASSWORD,
  buildSuperuserDatabaseUrl,
  createPostgresConnection,
} from '../helpers';

const TEST_IP = `10.reginv.${randomBytes(4).toString('hex')}`;
const queryApi = new QueryApiClient(GATEWAY_URL);

/** Helper: create an invitation and return its token. */
async function createInvitation(
  ownerToken: string,
  opts: { email?: string; role?: string } = {},
): Promise<{ id: string; token: string }> {
  const res = await queryApi.auth.requestRaw('POST', '/v1/invitations', {
    headers: { Authorization: `Bearer ${ownerToken}`, 'X-Forwarded-For': TEST_IP },
    body: { role: opts.role ?? 'member', ...(opts.email ? { email: opts.email } : {}) },
  });
  return (await res.json()) as { id: string; token: string };
}

describe('Register with invitation', () => {
  let ownerToken: string;

  beforeAll(async () => {
    await waitForService(GATEWAY_URL);
    ownerToken = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD, {
      organizationId: SEED_ORG_ID,
      forwardedIp: TEST_IP,
    });
  }, 30_000);

  it('registers user with valid invite and assigns correct role', async () => {
    const { token: inviteToken } = await createInvitation(ownerToken, { role: 'member' });
    const email = `invite-${randomBytes(4).toString('hex')}@test.dev`;

    const regRes = await queryApi.auth.register(
      { email, password: 'password123', name: 'Invited User', inviteToken },
      TEST_IP,
    );

    expect(regRes.status).toBe(201);
    expect(regRes.body.token).toBeDefined();
    expect(regRes.body.organization?.id).toBe(SEED_ORG_ID);

    const meRes = await queryApi.auth.me(regRes.body.token, TEST_IP);
    expect(meRes.status).toBe(200);
    expect(meRes.body.role).toBe('member');
    expect(meRes.body.organizationId).toBe(SEED_ORG_ID);
  });

  it('registers with email-restricted invite and matching email', async () => {
    const targetEmail = `restricted-${randomBytes(4).toString('hex')}@test.dev`;
    const { token: inviteToken } = await createInvitation(ownerToken, {
      email: targetEmail,
      role: 'member',
    });

    const regRes = await queryApi.auth.register(
      { email: targetEmail, password: 'password123', name: 'Restricted User', inviteToken },
      TEST_IP,
    );

    expect(regRes.status).toBe(201);
  });

  it('rejects registration with email-restricted invite and wrong email', async () => {
    const targetEmail = `target-${randomBytes(4).toString('hex')}@test.dev`;
    const wrongEmail = `wrong-${randomBytes(4).toString('hex')}@test.dev`;
    const { token: inviteToken } = await createInvitation(ownerToken, { email: targetEmail });

    const regRes = await queryApi.auth.register(
      { email: wrongEmail, password: 'password123', name: 'Wrong Email', inviteToken },
      TEST_IP,
    );

    expect(regRes.status).toBe(400);
  });

  it('rejects registration with already-accepted invite', async () => {
    const { token: inviteToken } = await createInvitation(ownerToken);
    const email1 = `first-${randomBytes(4).toString('hex')}@test.dev`;
    const email2 = `second-${randomBytes(4).toString('hex')}@test.dev`;

    const res1 = await queryApi.auth.register(
      { email: email1, password: 'password123', name: 'First User', inviteToken },
      TEST_IP,
    );
    expect(res1.status).toBe(201);

    const res2 = await queryApi.auth.register(
      { email: email2, password: 'password123', name: 'Second User', inviteToken },
      TEST_IP,
    );
    expect(res2.status).toBe(400);
  });

  it('rejects registration with revoked invite', async () => {
    const { id, token: inviteToken } = await createInvitation(ownerToken);

    await queryApi.auth.requestRaw('DELETE', `/v1/invitations/${id}`, {
      headers: { Authorization: `Bearer ${ownerToken}`, 'X-Forwarded-For': TEST_IP },
    });

    const email = `revoked-${randomBytes(4).toString('hex')}@test.dev`;
    const regRes = await queryApi.auth.register({
      email,
      password: 'password123',
      name: 'Revoked Invite',
      inviteToken,
    });

    expect(regRes.status).toBe(400);
  });

  it('rejects registration with invalid invite token', async () => {
    const email = `invalid-${randomBytes(4).toString('hex')}@test.dev`;

    const regRes = await queryApi.auth.register({
      email,
      password: 'password123',
      name: 'Invalid Token',
      inviteToken: 'not-a-real-token',
    });

    expect(regRes.status).toBe(400);
  });

  it('rejects registration with expired invite', async () => {
    const { token: inviteToken, id: invitationId } = await createInvitation(ownerToken);

    // Expire the invitation via direct DB update (superuser bypasses RLS)
    const pg = await createPostgresConnection(buildSuperuserDatabaseUrl());
    try {
      await pg`UPDATE invitations SET expires_at = now() - interval '1 day' WHERE id = ${invitationId}::uuid`;
    } finally {
      await pg.end();
    }

    const email = `expired-${randomBytes(4).toString('hex')}@test.dev`;
    const regRes = await queryApi.auth.register({
      email,
      password: 'password123',
      name: 'Expired Invite',
      inviteToken,
    });

    expect(regRes.status).toBe(400);
  });

  it('returns 409 when email already exists', async () => {
    const { token: inviteToken } = await createInvitation(ownerToken);

    const regRes = await queryApi.auth.register({
      email: SEED_EMAIL,
      password: 'password123',
      name: 'Duplicate',
      inviteToken,
    });

    expect(regRes.status).toBe(409);
  });
});
