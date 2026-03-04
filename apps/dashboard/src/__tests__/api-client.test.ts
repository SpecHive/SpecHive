import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  apiClient.setToken(null);
  apiClient.setOnUnauthorized(null);
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

  it('redirects to /login on 401', async () => {
    const originalHref = window.location.href;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: originalHref },
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Unauthorized' }),
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

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Unauthorized' }),
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
});
