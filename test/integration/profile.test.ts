/**
 * Profile & password management integration tests.
 *
 * Verifies:
 * - PATCH /v1/auth/profile updates name
 * - POST /v1/auth/change-password works with correct current password
 * - POST /v1/auth/change-password rejects wrong current password
 * - After password change, old credentials fail and new ones work
 * - After password change, old refresh tokens are revoked
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

const TEST_IP = `10.profile.${randomBytes(4).toString('hex')}`;
const queryApi = new QueryApiClient(QUERY_API_URL);

describe('Profile management', () => {
  let token: string;

  beforeAll(async () => {
    await waitForService(QUERY_API_URL);
    token = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD, {
      organizationId: SEED_ORG_ID,
      forwardedIp: TEST_IP,
    });
  }, 30_000);

  it('updates profile name via PATCH /v1/auth/profile', async () => {
    const newName = `Test User ${randomBytes(4).toString('hex')}`;

    const { status, body } = await queryApi.auth.updateProfile(token, { name: newName }, TEST_IP);

    expect(status).toBe(200);
    expect(body.name).toBe(newName);

    // Verify GET /v1/auth/me returns the updated name
    const { body: meBody } = await queryApi.auth.me(token, TEST_IP);
    expect(meBody.name).toBe(newName);
  });

  it('rejects empty name', async () => {
    const { status } = await queryApi.auth.updateProfile(token, { name: '   ' }, TEST_IP);

    expect(status).toBe(400);
  });
});

describe('Change password', () => {
  const uniqueSuffix = randomBytes(4).toString('hex');
  const testEmail = `profile-test-${uniqueSuffix}@spechive.dev`;
  const testPassword = 'original-password-123';
  const newPassword = 'new-password-456';

  beforeAll(async () => {
    await waitForService(QUERY_API_URL);
  }, 30_000);

  it('rejects wrong current password', async () => {
    const { body } = await queryApi.auth.register(
      {
        email: `reject-wrong-${uniqueSuffix}@spechive.dev`,
        password: testPassword,
        name: 'Wrong Password Test',
        organizationName: `WrongPwdOrg-${uniqueSuffix}`,
      },
      TEST_IP,
    );

    const { status } = await queryApi.auth.changePassword(
      body.token,
      { currentPassword: 'totally-wrong', newPassword: 'doesnt-matter' },
      TEST_IP,
    );

    expect(status).toBe(401);
  });

  describe('after successful password change', () => {
    let preChangeRefreshCookie: string;

    beforeAll(async () => {
      // Register a dedicated user and immediately change their password
      const { body, refreshCookie } = await queryApi.auth.register(
        {
          email: testEmail,
          password: testPassword,
          name: 'Password Test User',
          organizationName: `PasswordTestOrg-${uniqueSuffix}`,
        },
        TEST_IP,
      );
      preChangeRefreshCookie = refreshCookie!;

      const { status } = await queryApi.auth.changePassword(
        body.token,
        { currentPassword: testPassword, newPassword },
        TEST_IP,
      );
      expect(status).toBe(200);
    });

    it('login with new password works', async () => {
      const { status } = await queryApi.auth.login(testEmail, newPassword, {
        forwardedIp: TEST_IP,
      });

      expect(status).toBe(200);
    });

    it('login with old password fails', async () => {
      const { status } = await queryApi.auth.login(testEmail, testPassword, {
        forwardedIp: TEST_IP,
      });

      expect(status).toBe(401);
    });

    it('old refresh token is revoked', async () => {
      const { status } = await queryApi.auth.refresh(preChangeRefreshCookie, TEST_IP);

      expect(status).toBe(401);
    });
  });
});
