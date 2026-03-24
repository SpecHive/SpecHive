import { randomBytes } from 'node:crypto';

import { BaseClient, type ApiResponse } from './base-client';

/** HTTP client for the artifacts resource (`/v1/artifacts`). */
export class ArtifactsClient extends BaseClient {
  /** GET /v1/artifacts/:id/download — get a presigned download URL. */
  async download(
    token: string,
    artifactId: string,
    forwardedIp?: string,
  ): Promise<ApiResponse<{ url: string; expiresIn: number }>> {
    return this.request('GET', `/v1/artifacts/${artifactId}/download`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Forwarded-For': forwardedIp ?? `10.test.${randomBytes(4).toString('hex')}`,
      },
    });
  }
}
