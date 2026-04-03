type OnTokenRefreshCallback = (token: string) => void;

class ApiClient {
  private baseUrl: string = '';
  private token: string | null = null;
  private onUnauthorized: (() => void) | null = null;
  private onTokenRefresh: OnTokenRefreshCallback | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  setOnUnauthorized(callback: (() => void) | null): void {
    this.onUnauthorized = callback;
  }

  setOnTokenRefresh(callback: OnTokenRefreshCallback | null): void {
    this.onTokenRefresh = callback;
  }

  async get<T>(
    path: string,
    params?: Record<string, string>,
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    this.assertConfigured();
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, value);
        }
      }
    }
    return this.request<T>(url.toString(), {
      method: 'GET',
      ...(options?.signal ? { signal: options.signal } : {}),
    });
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    this.assertConfigured();
    return this.request<T>(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    this.assertConfigured();
    return this.request<T>(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    this.assertConfigured();
    return this.request<T>(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async delete<T>(path: string): Promise<T> {
    this.assertConfigured();
    return this.request<T>(`${this.baseUrl}${path}`, { method: 'DELETE' });
  }

  async silentRefresh(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });

      if (!response.ok) return null;

      const data = (await response.json()) as { token: string };
      this.token = data.token;

      if (this.onTokenRefresh) {
        this.onTokenRefresh(data.token);
      }

      return data.token;
    } catch {
      return null;
    }
  }

  async stream(path: string, init?: RequestInit): Promise<Response> {
    this.assertConfigured();
    const url = `${this.baseUrl}${path}`;
    return this.streamRequest(url, init ?? {});
  }

  private assertConfigured(): void {
    if (!this.baseUrl) {
      throw new Error(
        'ApiClient: baseUrl not configured. Call apiClient.setBaseUrl() before making requests.',
      );
    }
  }

  private handleUnauthorized(): never {
    this.token = null;
    if (this.onUnauthorized) {
      this.onUnauthorized();
    } else {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  private async authenticatedFetch(
    url: string,
    init: RequestInit,
    isRetry = false,
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const response = await fetch(url, { ...init, headers, credentials: 'include' });

    if (response.status === 401 && !isRetry) {
      const refreshed = await this.tryRefresh();
      if (refreshed) return this.authenticatedFetch(url, init, true);
      this.handleUnauthorized();
    }

    if (response.status === 401) this.handleUnauthorized();

    return response;
  }

  private async streamRequest(url: string, init: RequestInit): Promise<Response> {
    const response = await this.authenticatedFetch(url, init);

    if (!response.ok || !response.body) {
      throw new Error(`Stream failed: ${response.status}`);
    }

    return response;
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await this.authenticatedFetch(url, init);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(
        (errorBody as { message?: string }).message ||
          `Request failed with status ${response.status}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private async tryRefresh(): Promise<boolean> {
    // Mutex: if refresh already in progress, await the same promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });

      if (!response.ok) return false;

      const data = (await response.json()) as { token: string };
      this.token = data.token;

      if (this.onTokenRefresh) {
        this.onTokenRefresh(data.token);
      }

      return true;
    } catch {
      return false;
    }
  }
}

export const apiClient = new ApiClient();
