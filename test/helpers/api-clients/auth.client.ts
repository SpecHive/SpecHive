import { randomBytes } from 'node:crypto';

import { BaseClient, type ApiResponse } from './base-client';

interface LoginOptions {
  organizationId?: string;
  forwardedIp?: string;
}

interface LoginResponse {
  token: string;
  user?: { id: string; email: string; name: string };
  organization?: { id: string; name: string; slug: string };
}

interface MeResponse {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: string;
}

export interface AuthResponse<T> extends ApiResponse<T> {
  refreshCookie: string | null;
}

/** Extract the `spechive_rt` cookie value from Set-Cookie headers. */
function extractRefreshCookie(response: Response): string | null {
  const cookies = response.headers.getSetCookie();
  for (const cookie of cookies) {
    const match = cookie.match(/^spechive_rt=([^;]+)/);
    if (match) return match[1]!;
  }
  return null;
}

/** Build a Cookie header string from a raw cookie value. */
function cookieHeader(refreshCookie: string): string {
  return `spechive_rt=${refreshCookie}`;
}

export class AuthClient extends BaseClient {
  /** Login and return parsed response with refresh cookie. */
  async login(
    email: string,
    password: string,
    options?: LoginOptions,
  ): Promise<AuthResponse<LoginResponse>> {
    const res = await this.requestRaw('POST', '/v1/auth/login', {
      headers: { 'X-Forwarded-For': options?.forwardedIp ?? this.randomIp() },
      body: {
        email,
        password,
        ...(options?.organizationId ? { organizationId: options.organizationId } : {}),
      },
    });
    const body = (await res.json()) as LoginResponse;
    return { status: res.status, body, refreshCookie: extractRefreshCookie(res) };
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
    body: {
      email: string;
      password: string;
      name: string;
      organizationName?: string;
      inviteToken?: string;
    },
    forwardedIp?: string,
  ): Promise<AuthResponse<LoginResponse>> {
    const res = await this.requestRaw('POST', '/v1/auth/register', {
      headers: { 'X-Forwarded-For': forwardedIp ?? this.randomIp() },
      body,
    });
    const parsed = (await res.json()) as LoginResponse;
    return { status: res.status, body: parsed, refreshCookie: extractRefreshCookie(res) };
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
  ): Promise<AuthResponse<LoginResponse>> {
    const res = await this.requestRaw('POST', '/v1/auth/switch-organization', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Forwarded-For': forwardedIp ?? this.randomIp(),
      },
      body: { organizationId },
    });
    const body = (await res.json()) as LoginResponse;
    return { status: res.status, body, refreshCookie: extractRefreshCookie(res) };
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

  async updateProfile(
    token: string,
    body: { name: string },
    forwardedIp?: string,
  ): Promise<ApiResponse<MeResponse>> {
    return this.request<MeResponse>('PATCH', '/v1/auth/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Forwarded-For': forwardedIp ?? this.randomIp(),
      },
      body,
    });
  }

  async changePassword(
    token: string,
    body: { currentPassword: string; newPassword: string },
    forwardedIp?: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>('POST', '/v1/auth/change-password', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Forwarded-For': forwardedIp ?? this.randomIp(),
      },
      body,
    });
  }

  async refresh(refreshCookie: string, forwardedIp?: string): Promise<AuthResponse<LoginResponse>> {
    const res = await this.requestRaw('POST', '/v1/auth/refresh', {
      headers: { 'X-Forwarded-For': forwardedIp ?? this.randomIp() },
      cookies: cookieHeader(refreshCookie),
      body: {},
    });
    const body = (await res.json()) as LoginResponse;
    return { status: res.status, body, refreshCookie: extractRefreshCookie(res) };
  }

  async logout(refreshCookie: string, forwardedIp?: string): Promise<ApiResponse<void>> {
    const res = await this.requestRaw('POST', '/v1/auth/logout', {
      headers: { 'X-Forwarded-For': forwardedIp ?? this.randomIp() },
      cookies: cookieHeader(refreshCookie),
    });
    return { status: res.status, body: undefined as void };
  }

  private randomIp(): string {
    return `10.test.${randomBytes(4).toString('hex')}`;
  }
}
