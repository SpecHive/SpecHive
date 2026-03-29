import { randomUUID } from 'node:crypto';

import { describe, it, expect, beforeAll } from 'vitest';

import { IngestionApiClient, QueryApiClient } from '../helpers/api-clients';
import {
  GATEWAY_URL,
  PROJECT_TOKEN,
  SEED_PROJECT_ID,
  SEED_EMAIL,
  SEED_PASSWORD,
} from '../helpers/constants';
import {
  createRunStartEvent,
  createRunEndEvent,
  createSuiteStartEvent,
  createSuiteEndEvent,
  createTestStartEvent,
  createTestEndEvent,
  createArtifactUploadEvent,
} from '../helpers/factories';
import { waitForService, poll } from '../helpers/wait';

const ingestionApi = new IngestionApiClient(GATEWAY_URL, PROJECT_TOKEN);
const queryApi = new QueryApiClient(GATEWAY_URL);

describe('Artifact download', () => {
  const runId = randomUUID();
  const suiteId = randomUUID();
  const testId = randomUUID();
  const artifactContent = 'Hello, this is a test artifact!';

  let jwtToken: string;

  beforeAll(async () => {
    await waitForService(GATEWAY_URL);

    await ingestionApi.events.send(
      createRunStartEvent({ runId, payload: { runName: 'artifact-download-test' } }),
    );

    await ingestionApi.events.send(
      createSuiteStartEvent({ runId, payload: { suiteId, suiteName: 'Artifact Suite' } }),
    );

    await ingestionApi.events.send(
      createTestStartEvent({ runId, payload: { testId, suiteId, testName: 'artifact test' } }),
    );

    const { status: presignStatus, body: presign } = await ingestionApi.artifacts.presign({
      runId,
      testId,
      fileName: 'test-screenshot.png',
      contentType: 'image/png',
      sizeBytes: Buffer.byteLength(artifactContent),
    });
    expect(presignStatus).toBe(201);

    const uploadResponse = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: artifactContent,
    });
    expect(uploadResponse.ok).toBe(true);

    await ingestionApi.events.send(
      createArtifactUploadEvent({
        runId,
        payload: {
          artifactId: presign.artifactId,
          testId,
          artifactType: 'screenshot',
          name: 'test-screenshot.png',
          storagePath: presign.storagePath,
          mimeType: 'image/png',
        },
      }),
    );

    await ingestionApi.events.send(
      createTestEndEvent({ runId, payload: { testId, status: 'passed', durationMs: 100 } }),
    );

    await ingestionApi.events.send(createSuiteEndEvent({ runId, payload: { suiteId } }));

    await ingestionApi.events.send(createRunEndEvent({ runId, payload: { status: 'passed' } }));

    jwtToken = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD);

    await poll(
      async () => {
        const { body } = await queryApi.runs.list(jwtToken, SEED_PROJECT_ID);
        return body.data?.some((r) => r['id'] === runId) ?? false;
      },
      { maxAttempts: 30, delayMs: 1000 },
    );

    const testsResult = await poll(
      async () => {
        const { status, body } = await queryApi.runs.tests(jwtToken, runId);
        if (status === 200 && (body as { data: unknown[] }).data?.length > 0) {
          return (body as { data: { id: string }[] }).data[0]!.id;
        }
        return undefined;
      },
      { predicate: (id): id is string => id !== undefined, maxAttempts: 30, delayMs: 1000 },
    );

    await poll(
      async () => {
        const { status, body } = await queryApi.runs.testDetail(jwtToken, runId, testsResult);
        if (status === 200) {
          const detail = body as { artifacts: { id: string }[] };
          return detail.artifacts?.length > 0;
        }
        return false;
      },
      { maxAttempts: 30, delayMs: 1000 },
    );
  }, 60_000);

  it('fetches artifact download URL and downloads the content', async () => {
    const { status: testsStatus, body: testsBody } = await queryApi.runs.tests(jwtToken, runId);
    expect(testsStatus).toBe(200);

    const tests = testsBody as { data: { id: string }[] };
    expect(tests.data.length).toBeGreaterThan(0);

    const { status: detailStatus, body: detailBody } = await queryApi.runs.testDetail(
      jwtToken,
      runId,
      tests.data[0]!.id,
    );
    expect(detailStatus).toBe(200);

    const test = detailBody as { id: string; artifacts: { id: string; name: string }[] };
    expect(test.artifacts).toBeDefined();
    expect(test.artifacts.length).toBeGreaterThan(0);

    const artifactId = test.artifacts[0]!.id;

    const { status: downloadStatus, body: downloadBody } = await queryApi.artifacts.download(
      jwtToken,
      artifactId,
    );
    expect(downloadStatus).toBe(200);

    const download = downloadBody as { url: string; expiresIn: number };
    expect(download.url).toBeDefined();
    expect(download.expiresIn).toBe(900);

    const artifactResponse = await fetch(download.url);
    expect(artifactResponse.status).toBe(200);

    const content = await artifactResponse.text();
    expect(content).toBe(artifactContent);
  });
});
