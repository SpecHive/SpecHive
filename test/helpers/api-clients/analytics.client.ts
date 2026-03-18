import { randomBytes } from 'node:crypto';

import { BaseClient, type ApiResponse } from './base-client';

/** HTTP client for the analytics endpoints (`/v1/analytics/*`). */
export class AnalyticsClient extends BaseClient {
  private authHeaders(token: string, forwardedIp?: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'X-Forwarded-For': forwardedIp ?? `10.test.${randomBytes(4).toString('hex')}`,
    };
  }

  /** GET /v1/analytics/summary?projectIds=:id — KPI summary for a project. */
  async summary(
    token: string,
    projectId: string,
    days = 30,
    forwardedIp?: string,
  ): Promise<ApiResponse> {
    return this.request('GET', `/v1/analytics/summary?projectIds=${projectId}&days=${days}`, {
      headers: this.authHeaders(token, forwardedIp),
    });
  }

  /** GET /v1/analytics/pass-rate-trend?projectIds=:id — daily pass-rate trend. */
  async passRateTrend(
    token: string,
    projectId: string,
    days = 30,
    forwardedIp?: string,
  ): Promise<ApiResponse> {
    return this.request(
      'GET',
      `/v1/analytics/pass-rate-trend?projectIds=${projectId}&days=${days}`,
      { headers: this.authHeaders(token, forwardedIp) },
    );
  }

  /** GET /v1/analytics/duration-trend?projectIds=:id — daily duration trend. */
  async durationTrend(
    token: string,
    projectId: string,
    days = 30,
    forwardedIp?: string,
  ): Promise<ApiResponse> {
    return this.request(
      'GET',
      `/v1/analytics/duration-trend?projectIds=${projectId}&days=${days}`,
      { headers: this.authHeaders(token, forwardedIp) },
    );
  }

  /** GET /v1/analytics/flaky-tests?projectIds=:id — top flaky tests. */
  async flakyTests(
    token: string,
    projectId: string,
    days = 30,
    limit = 10,
    forwardedIp?: string,
  ): Promise<ApiResponse> {
    return this.request(
      'GET',
      `/v1/analytics/flaky-tests?projectIds=${projectId}&days=${days}&limit=${limit}`,
      { headers: this.authHeaders(token, forwardedIp) },
    );
  }

  /** Raw request for unauthorized/invalid tests. */
  async summaryRaw(projectId: string, headers?: Record<string, string>): Promise<Response> {
    return this.requestRaw('GET', `/v1/analytics/summary?projectIds=${projectId}`, {
      headers: headers ?? {},
    });
  }

  // --- Organization-level endpoints (no projectId) ---

  /** GET /v1/analytics/summary — KPI summary across all projects in the org. */
  async orgSummary(token: string, days = 30, forwardedIp?: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/analytics/summary?days=${days}`, {
      headers: this.authHeaders(token, forwardedIp),
    });
  }

  /** GET /v1/analytics/pass-rate-trend — daily pass-rate trend across the org. */
  async orgPassRateTrend(token: string, days = 30, forwardedIp?: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/analytics/pass-rate-trend?days=${days}`, {
      headers: this.authHeaders(token, forwardedIp),
    });
  }

  /** GET /v1/analytics/duration-trend — daily duration trend across the org. */
  async orgDurationTrend(token: string, days = 30, forwardedIp?: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/analytics/duration-trend?days=${days}`, {
      headers: this.authHeaders(token, forwardedIp),
    });
  }

  /** GET /v1/analytics/flaky-tests — top flaky tests across the org. */
  async orgFlakyTests(
    token: string,
    days = 30,
    limit = 10,
    forwardedIp?: string,
  ): Promise<ApiResponse> {
    return this.request('GET', `/v1/analytics/flaky-tests?days=${days}&limit=${limit}`, {
      headers: this.authHeaders(token, forwardedIp),
    });
  }

  /** GET /v1/analytics/project-comparison — per-project breakdown for the org. */
  async orgProjectComparison(token: string, days = 30, forwardedIp?: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/analytics/project-comparison?days=${days}`, {
      headers: this.authHeaders(token, forwardedIp),
    });
  }

  /** Raw request for org summary — for error testing. */
  async orgSummaryRaw(headers?: Record<string, string>): Promise<Response> {
    return this.requestRaw('GET', '/v1/analytics/summary', { headers: headers ?? {} });
  }
}
