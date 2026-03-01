import type { V1Event } from '@assertly/reporter-core-protocol';

export interface SendEventResult {
  eventId: string;
}

export class AssertlyClient {
  private readonly apiUrl: string;
  private readonly projectToken: string;

  constructor(apiUrl: string, projectToken: string) {
    this.apiUrl = apiUrl;
    this.projectToken = projectToken;
  }

  async sendEvent(_event: V1Event): Promise<SendEventResult> {
    // TODO: Implement HTTP POST in ticket 2.2
    void this.apiUrl;
    void this.projectToken;
    return { eventId: '' };
  }
}
