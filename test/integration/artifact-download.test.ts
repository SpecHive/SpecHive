/**
 * Artifact download E2E integration test.
 *
 * Verifies the happy-path artifact pipeline:
 * 1. Ingest a test run with an artifact via ingestion-api
 * 2. Worker processes events (via Outboxy)
 * 3. Download the artifact via query-api presigned URL
 *
 * Requires the full Docker Compose stack running:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
 *
 * Run with:
 *   pnpm test:integration
 */

import { randomUUID } from 'node:crypto';

import { describe, it, expect, beforeAll } from 'vitest';

const INGESTION_API_URL = process.env['INGESTION_API_URL'] ?? 'http://localhost:3000';
const QUERY_API_URL = process.env['QUERY_API_URL'] ?? 'http://localhost:3002';
const PROJECT_TOKEN = 'test-token';
const TEST_USER_EMAIL = 'test-user@assertly.dev';
const TEST_USER_PASSWORD = 'test-password';
const INTEGRATION_ORG_ID = '01970000-0000-7000-8000-000000000001';
const INTEGRATION_PROJECT_ID = '01970000-0000-7000-8000-000000000002';

async function waitForService(url: string, maxAttempts = 30, delayMs = 1000): Promise<void> {
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

async function sendEvent(event: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${INGESTION_API_URL}/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-project-token': PROJECT_TOKEN,
    },
    body: JSON.stringify(event),
  });

  if (response.status !== 202) {
    const text = await response.text();
    throw new Error(`Event ingestion failed (${response.status}): ${text}`);
  }
}

async function login(): Promise<string> {
  const response = await fetch(`${QUERY_API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      organizationId: INTEGRATION_ORG_ID,
    }),
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { token: string };
  return body.token;
}

function timestamp(): string {
  return new Date().toISOString();
}

describe('Artifact download', () => {
  const runId = randomUUID();
  const suiteId = randomUUID();
  const testId = randomUUID();
  const artifactContent = 'Hello, this is a test artifact!';
  const artifactBase64 = Buffer.from(artifactContent).toString('base64');

  let jwtToken: string;

  beforeAll(async () => {
    await waitForService(INGESTION_API_URL);
    await waitForService(QUERY_API_URL);

    // Ingest a complete test run with an artifact
    await sendEvent({
      version: '1',
      timestamp: timestamp(),
      runId,
      eventType: 'run.start',
      payload: { runName: 'artifact-download-test' },
    });

    await sendEvent({
      version: '1',
      timestamp: timestamp(),
      runId,
      eventType: 'suite.start',
      payload: { suiteId, suiteName: 'Artifact Suite' },
    });

    await sendEvent({
      version: '1',
      timestamp: timestamp(),
      runId,
      eventType: 'test.start',
      payload: { testId, suiteId, testName: 'artifact test' },
    });

    await sendEvent({
      version: '1',
      timestamp: timestamp(),
      runId,
      eventType: 'artifact.upload',
      payload: {
        testId,
        artifactType: 'screenshot',
        name: 'test-screenshot.png',
        data: artifactBase64,
        mimeType: 'image/png',
      },
    });

    await sendEvent({
      version: '1',
      timestamp: timestamp(),
      runId,
      eventType: 'test.end',
      payload: { testId, status: 'passed', durationMs: 100 },
    });

    await sendEvent({
      version: '1',
      timestamp: timestamp(),
      runId,
      eventType: 'suite.end',
      payload: { suiteId },
    });

    await sendEvent({
      version: '1',
      timestamp: timestamp(),
      runId,
      eventType: 'run.end',
      payload: { status: 'passed' },
    });

    jwtToken = await login();

    // Wait for the worker to process events via Outboxy
    const maxPollAttempts = 30;
    const pollDelayMs = 1000;
    for (let attempt = 1; attempt <= maxPollAttempts; attempt++) {
      const runsResponse = await fetch(
        `${QUERY_API_URL}/v1/runs?projectId=${INTEGRATION_PROJECT_ID}`,
        { headers: { Authorization: `Bearer ${jwtToken}` } },
      );

      if (runsResponse.ok) {
        const runsBody = (await runsResponse.json()) as { data: { id: string }[] };
        const found = runsBody.data?.some((r) => r.id === runId);
        if (found) break;
      }

      if (attempt === maxPollAttempts) {
        throw new Error(`Run ${runId} did not appear in query-api within ${maxPollAttempts}s`);
      }
      await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
    }

    // Wait for tests to be processed (async via Outboxy)
    for (let attempt = 1; attempt <= maxPollAttempts; attempt++) {
      const testsResponse = await fetch(`${QUERY_API_URL}/v1/runs/${runId}/tests`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });

      if (testsResponse.ok) {
        const testsBody = (await testsResponse.json()) as { data: { id: string }[] };
        if (testsBody.data?.length > 0) break;
      }

      if (attempt === maxPollAttempts) {
        throw new Error(`Tests for run ${runId} did not appear within ${maxPollAttempts}s`);
      }
      await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
    }
  }, 60_000);

  it('fetches artifact download URL and downloads the content', async () => {
    // Get tests for the run
    const testsResponse = await fetch(`${QUERY_API_URL}/v1/runs/${runId}/tests`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
    expect(testsResponse.status).toBe(200);

    const testsBody = (await testsResponse.json()) as {
      data: { id: string }[];
    };
    expect(testsBody.data.length).toBeGreaterThan(0);

    // Use the detail endpoint which includes artifacts
    const testDetailResponse = await fetch(
      `${QUERY_API_URL}/v1/runs/${runId}/tests/${testsBody.data[0]!.id}`,
      { headers: { Authorization: `Bearer ${jwtToken}` } },
    );
    expect(testDetailResponse.status).toBe(200);

    const test = (await testDetailResponse.json()) as {
      id: string;
      artifacts: { id: string; name: string }[];
    };
    expect(test.artifacts).toBeDefined();
    expect(test.artifacts.length).toBeGreaterThan(0);

    const artifactId = test.artifacts[0]!.id;

    // Get the presigned download URL
    const downloadResponse = await fetch(`${QUERY_API_URL}/v1/artifacts/${artifactId}/download`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
    expect(downloadResponse.status).toBe(200);

    const downloadBody = (await downloadResponse.json()) as { url: string; expiresIn: number };
    expect(downloadBody.url).toBeDefined();
    expect(downloadBody.expiresIn).toBe(900);

    // Download the artifact via presigned URL
    const artifactResponse = await fetch(downloadBody.url);
    expect(artifactResponse.status).toBe(200);

    const content = await artifactResponse.text();
    expect(content).toBe(artifactContent);
  });
});
