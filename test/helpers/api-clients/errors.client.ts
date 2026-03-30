import { randomBytes } from 'node:crypto';

import { BaseClient, type ApiResponse } from './base-client';

interface ListErrorGroupsParams {
  projectId: string;
  dateFrom?: number;
  dateTo?: number;
  branch?: string;
  search?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
}

interface TimelineParams {
  projectId: string;
  dateFrom?: number;
  dateTo?: number;
  branch?: string;
  search?: string;
  category?: string;
  metric?: string;
  topN?: number;
}

/** HTTP client for the errors resource (`/v1/errors`). */
export class ErrorsClient extends BaseClient {
  private authHeaders(token: string, forwardedIp?: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'X-Forwarded-For': forwardedIp ?? `10.test.${randomBytes(4).toString('hex')}`,
    };
  }

  private toQuery(params: object): string {
    const entries = Object.entries(params).filter(([, v]) => v != null);
    return entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  }

  /** GET /v1/errors — list error groups. */
  async list(token: string, params: ListErrorGroupsParams): Promise<ApiResponse> {
    return this.request('GET', `/v1/errors?${this.toQuery(params)}`, {
      headers: this.authHeaders(token),
    });
  }

  /** GET /v1/errors/timeline — error timeline series. */
  async timeline(token: string, params: TimelineParams): Promise<ApiResponse> {
    return this.request('GET', `/v1/errors/timeline?${this.toQuery(params)}`, {
      headers: this.authHeaders(token),
    });
  }

  /** GET /v1/errors/:id — error group detail. */
  async detail(token: string, errorGroupId: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/errors/${errorGroupId}`, {
      headers: this.authHeaders(token),
    });
  }
}
