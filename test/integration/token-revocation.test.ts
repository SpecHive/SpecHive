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

const TEST_IP = `10.tok.rev.${randomBytes(4).toString('hex')}`;

const queryApi = new QueryApiClient(GATEWAY_URL);

describe('Token revocation', () => {
  let jwt: string;

  beforeAll(async () => {
    await waitForService(GATEWAY_URL);
    jwt = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD, {
      organizationId: SEED_ORG_ID,
      forwardedIp: TEST_IP,
    });
  }, 30_000);

  it('revoked token is rejected by ingestion-api', async () => {
    const projectName = `RevocationTest-${randomBytes(4).toString('hex')}`;

    const { status: projectStatus, body: project } = await queryApi.projects.create(
      jwt,
      projectName,
      TEST_IP,
    );
    expect(projectStatus).toBe(201);

    const { status: tokenStatus, body: tokenBody } = await queryApi.tokens.create(
      jwt,
      project.id,
      'Revocation Test Token',
      TEST_IP,
    );
    expect(tokenStatus).toBe(201);
    const plainToken = tokenBody.token;
    const tokenId = tokenBody.id;

    const ingestRes = await fetch(`${GATEWAY_URL}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-project-token': plainToken,
        'X-Forwarded-For': TEST_IP,
      },
      body: JSON.stringify({ type: 'run:started', payload: {} }),
    });
    // Guard should pass (not 401) — endpoint may return 400/422 for invalid payload
    expect(ingestRes.status).not.toBe(401);

    const revokeRes = await queryApi.tokens.revoke(jwt, tokenId, TEST_IP);
    expect(revokeRes.status).toBe(204);

    const revokedIngestRes = await fetch(`${GATEWAY_URL}/v1/events`, {
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
