export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
}

interface RequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  cookies?: string;
}

export class BaseClient {
  constructor(
    protected readonly baseUrl: string,
    protected readonly defaultHeaders: Record<string, string> = {},
  ) {}

  /** JSON request — parses response body. */
  async request<T = unknown>(
    method: string,
    path: string,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    const res = await this.requestRaw(method, path, options);
    const body = (await res.json()) as T;
    return { status: res.status, body };
  }

  /** Raw request — returns native Response for status/header inspection. */
  async requestRaw(method: string, path: string, options?: RequestOptions): Promise<Response> {
    const hasBody = options?.body !== undefined;
    const headers: Record<string, string> = {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...this.defaultHeaders,
      ...options?.headers,
      ...(options?.cookies ? { Cookie: options.cookies } : {}),
    };

    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: options?.signal,
    });
  }
}
