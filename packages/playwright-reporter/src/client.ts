import type { V1Event } from '@assertly/reporter-core-protocol';

export interface SendEventResult {
  ok: boolean;
  eventId?: string;
}

const DEFAULT_TIMEOUT = 10_000;

export class AssertlyClient {
  private readonly apiUrl: string;
  private readonly projectToken: string;
  private readonly timeout: number;

  constructor(apiUrl: string, projectToken: string, timeout = DEFAULT_TIMEOUT) {
    this.apiUrl = apiUrl;
    this.projectToken = projectToken;
    this.timeout = timeout;
  }

  async sendEvent(event: V1Event): Promise<SendEventResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(`${this.apiUrl}/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-project-token': this.projectToken,
        },
        body: JSON.stringify(event),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.warn(`[assertly] Event send failed (${response.status}): ${text}`);
        return { ok: false };
      }
      const body = (await response.json()) as { eventId: string };
      return { ok: true, eventId: body.eventId };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[assertly] Event send error: ${msg}`);
      return { ok: false };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
