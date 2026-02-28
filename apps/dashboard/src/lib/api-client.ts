const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null): void {
    this.token = token;
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

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const headers = new Headers(init.headers);
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const response = await fetch(url, { ...init, headers });

    if (response.status === 401) {
      this.token = null;
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(
        (errorBody as { message?: string }).message ||
          `Request failed with status ${response.status}`,
      );
    }

    return response.json() as Promise<T>;
  }
}

export const apiClient = new ApiClient();
