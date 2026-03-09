import { randomBytes } from 'node:crypto';

import { BaseClient, type ApiResponse } from './base-client';

interface LoginOptions {
  organizationId?: string;
  forwardedIp?: string;
}

interface LoginResponse {
  token: string;
  refreshToken?: string;
  user?: { id: string; email: string; name: string };
  organization?: { id: string; name: string; slug: string };
}

interface MeResponse {
  id: string;
  email: string;
  organizationId: string;
  role: string;
}

export class AuthClient extends BaseClient {
  /** Login and return parsed response. */
  async login(
    email: string,
    password: string,
    options?: LoginOptions,
  ): Promise<ApiResponse<LoginResponse>> {
    return this.request<LoginResponse>('POST', '/v1/auth/login', {
      headers: { 'X-Forwarded-For': options?.forwardedIp ?? this.randomIp() },
      body: {
        email,
        password,
        ...(options?.organizationId ? { organizationId: options.organizationId } : {}),
      },
    });
  }

  /** Login and return just the JWT token. Throws if login fails. */
  async loginToken(email: string, password: string, options?: LoginOptions): Promise<string> {
    const { status, body } = await this.login(email, password, options);
    if (status !== 200) throw new Error(`Login failed with status ${status}`);
    return body.token;
  }

  /** Raw login — returns native Response. */
  async loginRaw(email: string, password: string, options?: LoginOptions): Promise<Response> {
    return this.requestRaw('POST', '/v1/auth/login', {
      headers: { 'X-Forwarded-For': options?.forwardedIp ?? this.randomIp() },
      body: {
        email,
        password,
        ...(options?.organizationId ? { organizationId: options.organizationId } : {}),
      },
    });
  }

  async register(
    body: { email: string; password: string; name: string; organizationName: string },
    forwardedIp?: string,
  ): Promise<ApiResponse<LoginResponse>> {
    return this.request<LoginResponse>('POST', '/v1/auth/register', {
      headers: { 'X-Forwarded-For': forwardedIp ?? this.randomIp() },
      body,
    });
  }

  async me(token: string, forwardedIp?: string): Promise<ApiResponse<MeResponse>> {
    return this.request<MeResponse>('GET', '/v1/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Forwarded-For': forwardedIp ?? this.randomIp(),
      },
    });
  }

  async switchOrganization(
    token: string,
    organizationId: string,
    forwardedIp?: string,
  ): Promise<ApiResponse<{ token: string; organization: { id: string } }>> {
    return this.request('POST', '/v1/auth/switch-organization', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Forwarded-For': forwardedIp ?? this.randomIp(),
      },
      body: { organizationId },
    });
  }

  async organizations(
    token: string,
    forwardedIp?: string,
  ): Promise<ApiResponse<{ data: { id: string; name: string }[] }>> {
    return this.request('GET', '/v1/auth/organizations', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Forwarded-For': forwardedIp ?? this.randomIp(),
      },
    });
  }

  private randomIp(): string {
    return `10.test.${randomBytes(4).toString('hex')}`;
  }
}
