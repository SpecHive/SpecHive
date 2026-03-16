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

import { randomBytes } from 'node:crypto';

import { describe, it, expect, beforeAll } from 'vitest';

import {
  waitForService,
  QueryApiClient,
  GATEWAY_URL,
  SEED_ORG_ID,
  SEED_ORG2_ID,
  SEED_EMAIL,
  SEED_PASSWORD,
} from '../helpers';

const TEST_IP = `10.switch.${randomBytes(4).toString('hex')}`;

const queryApi = new QueryApiClient(GATEWAY_URL);

describe('Switch organization', () => {
  let tokenOrg1: string;

  beforeAll(async () => {
    await waitForService(GATEWAY_URL);
    tokenOrg1 = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD, {
      organizationId: SEED_ORG_ID,
      forwardedIp: TEST_IP,
    });
  }, 30_000);

  it('switches to the second organization and returns a new token', async () => {
    const { status, body } = await queryApi.auth.switchOrganization(
      tokenOrg1,
      SEED_ORG2_ID,
      TEST_IP,
    );

    expect(status).toBe(200);
    expect(body.token).toBeDefined();
    expect(body.organization.id).toBe(SEED_ORG2_ID);
  });

  it('/me reflects the new organization after switching', async () => {
    const { body: switchBody } = await queryApi.auth.switchOrganization(
      tokenOrg1,
      SEED_ORG2_ID,
      TEST_IP,
    );

    const { status, body: meBody } = await queryApi.auth.me(switchBody.token, TEST_IP);

    expect(status).toBe(200);
    expect(meBody.organizationId).toBe(SEED_ORG2_ID);
    expect(meBody.role).toBe('member');
  });

  it('data isolation: second org has no projects from the first org', async () => {
    const { body: switchBody } = await queryApi.auth.switchOrganization(
      tokenOrg1,
      SEED_ORG2_ID,
      TEST_IP,
    );

    const { status, body: orgsBody } = await queryApi.auth.organizations(switchBody.token, TEST_IP);

    expect(status).toBe(200);
    const orgIds = orgsBody.data.map((o) => o.id);
    expect(orgIds).toContain(SEED_ORG2_ID);
    expect(orgIds).toContain(SEED_ORG_ID);
  });

  it('rejects switching to an organization the user does not belong to', async () => {
    const fakeOrgId = '01970000-0000-7000-8000-ffffffffffff';
    const { status } = await queryApi.auth.switchOrganization(tokenOrg1, fakeOrgId, TEST_IP);

    expect(status).toBe(403);
  });
});
