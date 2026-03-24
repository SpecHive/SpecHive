import { BaseClient, type ApiResponse } from './base-client';

interface PresignRequest {
  runId: string;
  testId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

interface PresignResponse {
  artifactId: string;
  storagePath: string;
  uploadUrl: string;
  expiresIn: number;
}

/** HTTP client for the artifact presign endpoint (`/v1/artifacts/presign`). */
export class ArtifactsPresignClient extends BaseClient {
  constructor(
    baseUrl: string,
    private readonly projectToken: string,
  ) {
    super(baseUrl);
  }

  /** POST /v1/artifacts/presign — get a presigned S3 upload URL. */
  async presign(body: PresignRequest): Promise<ApiResponse<PresignResponse>> {
    return this.request<PresignResponse>('POST', '/v1/artifacts/presign', {
      headers: { 'x-project-token': this.projectToken },
      body,
    });
  }
}
