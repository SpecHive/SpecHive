import { randomBytes } from 'node:crypto';

import { describe, it, expect, beforeAll } from 'vitest';

import {
  waitForService,
  QueryApiClient,
  GATEWAY_URL,
  SEED_ORG_ID,
  SEED_EMAIL,
  SEED_PASSWORD,
} from '../helpers';

const TEST_IP = `10.members.${randomBytes(4).toString('hex')}`;
const queryApi = new QueryApiClient(GATEWAY_URL);

describe('Members API', () => {
  let ownerToken: string;

  beforeAll(async () => {
    await waitForService(GATEWAY_URL);
    ownerToken = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD, {
      organizationId: SEED_ORG_ID,
      forwardedIp: TEST_IP,
    });
  }, 30_000);

  it('returns members list with correct fields', async () => {
    const res = await queryApi.auth.requestRaw('GET', '/v1/members', {
      headers: { Authorization: `Bearer ${ownerToken}`, 'X-Forwarded-For': TEST_IP },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{
        id: string;
        userId: string;
        email: string;
        name: string;
        role: string;
        joinedAt: string | null;
      }>;
      meta: { total: number; page: number; pageSize: number; totalPages: number };
    };

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.meta.total).toBeGreaterThan(0);

    const seedMember = body.data.find((m) => m.email === SEED_EMAIL);
    expect(seedMember).toBeDefined();
    expect(seedMember!.role).toBe('owner');
  });

  it('rejects unauthenticated requests', async () => {
    const res = await queryApi.auth.requestRaw('GET', '/v1/members', {
      headers: { 'X-Forwarded-For': TEST_IP },
    });

    expect(res.status).toBe(401);
  });
});
