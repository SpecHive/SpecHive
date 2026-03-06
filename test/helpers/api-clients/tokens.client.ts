import { randomBytes } from 'node:crypto';

import { BaseClient, type ApiResponse } from './base-client';

interface TokenResponse {
  id: string;
  token: string;
  name: string;
}

/** HTTP client for the project tokens resource (`/v1/projects/:id/tokens`). */
export class TokensClient extends BaseClient {
  /** POST /v1/projects/:id/tokens — create a new project token. */
  async create(
    token: string,
    projectId: string,
    name: string,
    forwardedIp?: string,
  ): Promise<ApiResponse<TokenResponse>> {
    return this.request<TokenResponse>('POST', `/v1/projects/${projectId}/tokens`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Forwarded-For': forwardedIp ?? `10.test.${randomBytes(4).toString('hex')}`,
      },
      body: { name },
    });
  }

  /** DELETE /v1/projects/:id/tokens/:tokenId — revoke a project token. */
  async revoke(
    token: string,
    projectId: string,
    tokenId: string,
    forwardedIp?: string,
  ): Promise<Response> {
    return this.requestRaw('DELETE', `/v1/projects/${projectId}/tokens/${tokenId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Forwarded-For': forwardedIp ?? `10.test.${randomBytes(4).toString('hex')}`,
      },
    });
  }
}
