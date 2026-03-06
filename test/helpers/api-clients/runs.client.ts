import { randomBytes } from 'node:crypto';

import { BaseClient, type ApiResponse } from './base-client';

/** HTTP client for the runs resource (`/v1/runs`). */
export class RunsClient extends BaseClient {
  private authHeaders(token: string, forwardedIp?: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'X-Forwarded-For': forwardedIp ?? `10.test.${randomBytes(4).toString('hex')}`,
    };
  }

  /** GET /v1/runs?projectId=:id — list runs for a project. */
  async list(
    token: string,
    projectId: string,
    forwardedIp?: string,
  ): Promise<ApiResponse<{ data: Array<Record<string, unknown>> }>> {
    return this.request('GET', `/v1/runs?projectId=${projectId}`, {
      headers: this.authHeaders(token, forwardedIp),
    });
  }

  /** GET /v1/runs/:id — get a single run by ID. */
  async get(
    token: string,
    runId: string,
    forwardedIp?: string,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request('GET', `/v1/runs/${runId}`, {
      headers: this.authHeaders(token, forwardedIp),
    });
  }

  /** GET /v1/runs/:id/tests — list tests for a run. */
  async tests(
    token: string,
    runId: string,
    forwardedIp?: string,
  ): Promise<ApiResponse<{ data: Array<Record<string, unknown>> }>> {
    return this.request('GET', `/v1/runs/${runId}/tests`, {
      headers: this.authHeaders(token, forwardedIp),
    });
  }

  /** GET /v1/runs/:runId/tests/:testId — get test detail with artifacts. */
  async testDetail(
    token: string,
    runId: string,
    testId: string,
    forwardedIp?: string,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request('GET', `/v1/runs/${runId}/tests/${testId}`, {
      headers: this.authHeaders(token, forwardedIp),
    });
  }
}
