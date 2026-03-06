/**
 * Token revocation integration test.
 *
 * Verifies the full lifecycle:
 * 1. Login -> get JWT
 * 2. Create project via POST /v1/projects
 * 3. Create token via POST /v1/projects/:id/tokens -> get plain-text token
 * 4. Authenticate against ingestion-api with token -> expect success
 * 5. Revoke token via DELETE /v1/projects/:id/tokens/:tokenId
 * 6. Authenticate against ingestion-api with revoked token -> expect 401
 *
 * Requires the full Docker Compose stack running.
 */

import { randomBytes } from 'node:crypto';

import { describe, it, expect, beforeAll } from 'vitest';

import {
  waitForService,
  QueryApiClient,
  QUERY_API_URL,
  INGESTION_URL,
  SEED_ORG_ID,
  SEED_EMAIL,
  SEED_PASSWORD,
} from '../helpers';

const TEST_IP = `10.tok.rev.${randomBytes(4).toString('hex')}`;

const queryApi = new QueryApiClient(QUERY_API_URL);

describe('Token revocation', () => {
  let jwt: string;

  beforeAll(async () => {
    await Promise.all([waitForService(QUERY_API_URL), waitForService(INGESTION_URL)]);
    jwt = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD, {
      organizationId: SEED_ORG_ID,
      forwardedIp: TEST_IP,
    });
  }, 30_000);

  it('revoked token is rejected by ingestion-api', async () => {
    const projectName = `RevocationTest-${randomBytes(4).toString('hex')}`;

    // 1. Create project
    const { status: projectStatus, body: project } = await queryApi.projects.create(
      jwt,
      projectName,
      TEST_IP,
    );
    expect(projectStatus).toBe(201);

    // 2. Create token
    const { status: tokenStatus, body: tokenBody } = await queryApi.tokens.create(
      jwt,
      project.id,
      'Revocation Test Token',
      TEST_IP,
    );
    expect(tokenStatus).toBe(201);
    const plainToken = tokenBody.token;
    const tokenId = tokenBody.id;

    // 3. Verify token works against ingestion-api (raw fetch — uses dynamic project token, not the standard one)
    const ingestRes = await fetch(`${INGESTION_URL}/v1/events`, {
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
    const revokeRes = await queryApi.tokens.revoke(jwt, project.id, tokenId, TEST_IP);
    expect(revokeRes.status).toBe(204);

    // 5. Verify revoked token is rejected by ingestion-api (raw fetch — uses dynamic project token)
    const revokedIngestRes = await fetch(`${INGESTION_URL}/v1/events`, {
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
