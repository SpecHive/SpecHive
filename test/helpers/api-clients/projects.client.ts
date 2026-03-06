import { randomBytes } from 'node:crypto';

import { BaseClient, type ApiResponse } from './base-client';

/** HTTP client for the projects resource (`/v1/projects`). */
export class ProjectsClient extends BaseClient {
  /** POST /v1/projects — create a new project. */
  async create(
    token: string,
    name: string,
    forwardedIp?: string,
  ): Promise<ApiResponse<{ id: string; name: string }>> {
    return this.request('POST', '/v1/projects', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Forwarded-For': forwardedIp ?? `10.test.${randomBytes(4).toString('hex')}`,
      },
      body: { name },
    });
  }
}
