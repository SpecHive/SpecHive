import { randomBytes } from 'node:crypto';

import { BaseClient, type ApiResponse } from './base-client';

interface TokenResponse {
  id: string;
  token: string;
  name: string;
}

/** HTTP client for the tokens resource (`/v1/tokens`). */
export class TokensClient extends BaseClient {
  /** POST /v1/tokens — create a new project token. */
  async create(
    token: string,
    projectId: string,
    name: string,
    forwardedIp?: string,
  ): Promise<ApiResponse<TokenResponse>> {
    return this.request<TokenResponse>('POST', `/v1/tokens`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Forwarded-For': forwardedIp ?? `10.test.${randomBytes(4).toString('hex')}`,
      },
      body: { name, projectId },
    });
  }

  /** DELETE /v1/tokens/:tokenId — revoke a project token. */
  async revoke(token: string, tokenId: string, forwardedIp?: string): Promise<Response> {
    return this.requestRaw('DELETE', `/v1/tokens/${tokenId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Forwarded-For': forwardedIp ?? `10.test.${randomBytes(4).toString('hex')}`,
      },
    });
  }
}
