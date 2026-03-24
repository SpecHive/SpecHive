import { ArtifactsPresignClient } from './artifacts-presign.client';
import { EventsClient } from './events.client';

/** Composed client for ingestion-api (gateway). */
export class IngestionApiClient {
  readonly events: EventsClient;
  readonly artifacts: ArtifactsPresignClient;

  constructor(baseUrl: string, projectToken: string) {
    this.events = new EventsClient(baseUrl, projectToken);
    this.artifacts = new ArtifactsPresignClient(baseUrl, projectToken);
  }
}
