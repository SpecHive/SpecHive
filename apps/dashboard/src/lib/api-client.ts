const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

type OnTokenRefreshCallback = (token: string, refreshToken: string) => void;

class ApiClient {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private onUnauthorized: (() => void) | null = null;
  private onTokenRefresh: OnTokenRefreshCallback | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  setToken(token: string | null): void {
    this.token = token;
  }

  setRefreshToken(refreshToken: string | null): void {
    this.refreshToken = refreshToken;
  }

  setOnUnauthorized(callback: (() => void) | null): void {
    this.onUnauthorized = callback;
  }

  setOnTokenRefresh(callback: OnTokenRefreshCallback | null): void {
    this.onTokenRefresh = callback;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${API_BASE_URL}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, value);
        }
      }
    }
    return this.request<T>(url.toString(), { method: 'GET' });
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(`${API_BASE_URL}${path}`, { method: 'DELETE' });
  }

  private async request<T>(url: string, init: RequestInit, isRetry = false): Promise<T> {
    const headers = new Headers(init.headers);
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const response = await fetch(url, { ...init, headers });

    if (response.status === 401 && !isRetry) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.request<T>(url, init, true);
      }

      this.token = null;
      if (this.onUnauthorized) {
        this.onUnauthorized();
      } else {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (response.status === 401) {
      this.token = null;
      if (this.onUnauthorized) {
        this.onUnauthorized();
      } else {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(
        (errorBody as { message?: string }).message ||
          `Request failed with status ${response.status}`,
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private async tryRefresh(): Promise<boolean> {
    if (!this.refreshToken) return false;

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
      const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) return false;

      const data = (await response.json()) as { token: string; refreshToken: string };
      this.token = data.token;
      this.refreshToken = data.refreshToken;

      if (this.onTokenRefresh) {
        this.onTokenRefresh(data.token, data.refreshToken);
      }

      return true;
    } catch {
      return false;
    }
  }
}

export const apiClient = new ApiClient();
