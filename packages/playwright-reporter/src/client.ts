import type { V1Event } from '@assertly/reporter-core-protocol';

export interface SendEventResult {
  ok: boolean;
  eventId?: string;
  retryable?: boolean;
  statusCode?: number;
  retries?: number;
}

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_MAX_RETRIES = 3;

export class AssertlyClient {
  private readonly apiUrl: string;
  private readonly projectToken: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(
    apiUrl: string,
    projectToken: string,
    timeout = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_MAX_RETRIES,
  ) {
    this.apiUrl = apiUrl;
    this.projectToken = projectToken;
    this.timeout = timeout;
    this.maxRetries = maxRetries;
  }

  async sendEvent(event: V1Event): Promise<SendEventResult> {
    let lastResult: SendEventResult = { ok: false, retries: 0 };

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = 1000 * Math.pow(2, attempt - 1) + Math.random() * 500;
        console.warn(`[assertly] Retrying event (attempt ${attempt}/${this.maxRetries})...`);
        await this.sleep(delay);
      }

      lastResult = await this.attemptSend(event);
      lastResult.retries = attempt;

      if (lastResult.ok || !lastResult.retryable) return lastResult;
    }

    return lastResult;
  }

  async checkHealth(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async attemptSend(event: V1Event): Promise<SendEventResult> {
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
        return { ok: false, retryable: response.status >= 500, statusCode: response.status };
      }
      const body = (await response.json()) as { eventId: string };
      return { ok: true, eventId: body.eventId };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[assertly] Event send error: ${msg}`);
      return { ok: false, retryable: true };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
