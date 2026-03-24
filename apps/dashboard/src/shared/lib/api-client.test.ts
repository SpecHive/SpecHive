import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/shared/lib/api-client';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  apiClient.setBaseUrl('http://localhost:3000');
  apiClient.setToken(null);
  apiClient.setOnUnauthorized(null);
  apiClient.setOnTokenRefresh(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiClient', () => {
  it('adds Authorization header when token is set', async () => {
    apiClient.setToken('test-jwt-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });

    await apiClient.get('/v1/projects');

    const [, init] = mockFetch.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-jwt-token');
  });

  it('does not add Authorization header when no token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });

    await apiClient.get('/v1/projects');

    const [, init] = mockFetch.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBeNull();
  });

  it('includes credentials on all requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });

    await apiClient.get('/v1/projects');

    const [, init] = mockFetch.mock.calls[0];
    expect(init.credentials).toBe('include');
  });

  it('redirects to /login on 401 when refresh fails', async () => {
    const originalHref = window.location.href;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: originalHref },
    });

    // First call: 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Unauthorized' }),
    });

    // Refresh attempt: fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Invalid refresh token' }),
    });

    await expect(apiClient.get('/v1/projects')).rejects.toThrow('Unauthorized');
    expect(window.location.href).toBe('/login');
  });

  it('throws error with message from response body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Bad request' }),
    });

    await expect(apiClient.get('/v1/projects')).rejects.toThrow('Bad request');
  });

  it('appends query params to GET requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });

    await apiClient.get('/v1/runs', { projectId: 'abc', page: '2' });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('projectId=abc');
    expect(url).toContain('page=2');
  });

  it('calls onUnauthorized callback on 401 when registered', async () => {
    const callback = vi.fn();
    apiClient.setOnUnauthorized(callback);

    // First call: 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Unauthorized' }),
    });

    // Refresh attempt: fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Invalid refresh token' }),
    });

    await expect(apiClient.get('/v1/projects')).rejects.toThrow('Unauthorized');
    expect(callback).toHaveBeenCalledOnce();
  });

  it('sends JSON body for POST requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ token: 'jwt' }),
    });

    await apiClient.post('/v1/auth/login', { email: 'a@b.com', password: 'pass' });

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.com', password: 'pass' });
  });

  describe('refresh token', () => {
    it('retries request after successful refresh on 401', async () => {
      apiClient.setToken('expired-token');

      // First call: 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      // Refresh call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ token: 'new-token' }),
      });

      // Retry call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'result' }),
      });

      const result = await apiClient.get('/v1/projects');
      expect(result).toEqual({ data: 'result' });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('sends empty body with credentials on refresh', async () => {
      apiClient.setToken('expired-token');

      // First call: 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      // Refresh call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ token: 'new-token' }),
      });

      // Retry call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'ok' }),
      });

      await apiClient.get('/v1/projects');

      // Find the refresh call
      const refreshCall = mockFetch.mock.calls.find((call) =>
        (call[0] as string).includes('/v1/auth/refresh'),
      );
      expect(refreshCall).toBeDefined();
      const [, refreshInit] = refreshCall!;
      expect(JSON.parse(refreshInit.body)).toEqual({});
      expect(refreshInit.credentials).toBe('include');
    });

    it('calls onUnauthorized when refresh fails', async () => {
      const callback = vi.fn();
      apiClient.setToken('expired-token');
      apiClient.setOnUnauthorized(callback);

      // First call: 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      // Refresh call: fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid refresh token' }),
      });

      await expect(apiClient.get('/v1/projects')).rejects.toThrow('Unauthorized');
      expect(callback).toHaveBeenCalledOnce();
    });

    it('calls onTokenRefresh callback on successful refresh', async () => {
      const onRefresh = vi.fn();
      apiClient.setToken('expired-token');
      apiClient.setOnTokenRefresh(onRefresh);

      // First call: 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      // Refresh call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ token: 'new-token' }),
      });

      // Retry call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'ok' }),
      });

      await apiClient.get('/v1/projects');
      expect(onRefresh).toHaveBeenCalledWith('new-token');
    });

    it('deduplicates concurrent refresh attempts', async () => {
      apiClient.setToken('expired-token');

      // Both initial requests: 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      // Single refresh call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ token: 'new-token' }),
      });

      // Retry calls
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'a' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'b' }),
      });

      const [resultA, resultB] = await Promise.all([
        apiClient.get('/v1/a'),
        apiClient.get('/v1/b'),
      ]);

      expect(resultA).toEqual({ data: 'a' });
      expect(resultB).toEqual({ data: 'b' });

      // Count refresh calls (POST to /v1/auth/refresh)
      const refreshCalls = mockFetch.mock.calls.filter((call) =>
        (call[0] as string).includes('/v1/auth/refresh'),
      );
      expect(refreshCalls).toHaveLength(1);
    });
  });
});
