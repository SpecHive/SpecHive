import { BaseClient, type ApiResponse } from './base-client';

export class EventsClient extends BaseClient {
  constructor(
    baseUrl: string,
    private readonly projectToken: string,
  ) {
    super(baseUrl);
  }

  /** Send an event with the project token. Returns parsed response. */
  async send(event: Record<string, unknown>): Promise<ApiResponse> {
    return this.request('POST', '/v1/events', {
      headers: { 'x-project-token': this.projectToken },
      body: event,
    });
  }

  /** Send an event and return the raw Response (for status checks). */
  async sendRaw(event: Record<string, unknown>): Promise<Response> {
    return this.requestRaw('POST', '/v1/events', {
      headers: { 'x-project-token': this.projectToken },
      body: event,
    });
  }

  /** Send an event without the x-project-token header (for auth rejection tests). */
  async sendWithoutToken(event: Record<string, unknown>): Promise<Response> {
    return this.requestRaw('POST', '/v1/events', {
      headers: { 'x-project-token': '' },
      body: event,
    });
  }

  /** Send an event with a specific token (for testing invalid/revoked tokens). */
  async sendWithToken(event: Record<string, unknown>, token: string): Promise<Response> {
    return this.requestRaw('POST', '/v1/events', {
      headers: { 'x-project-token': token },
      body: event,
    });
  }
}
