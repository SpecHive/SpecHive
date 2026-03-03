import { HeadBucketCommand, type S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';

import { S3_BUCKET, S3_CLIENT } from '../../s3/s3.constants';

@Injectable()
export class S3HealthIndicator extends HealthIndicator {
  constructor(
    @Optional() @Inject(S3_CLIENT) private readonly s3Client?: S3Client,
    @Optional() @Inject(S3_BUCKET) private readonly bucket?: string,
  ) {
    super();
  }

  isAvailable(): boolean {
    return this.s3Client != null && this.bucket != null;
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    if (!this.s3Client || !this.bucket) {
      return this.getStatus(key, true, { message: 'S3 not configured' });
    }

    const start = performance.now();
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      const responseTimeMs = Math.round(performance.now() - start);
      return this.getStatus(key, true, { responseTimeMs });
    } catch (error) {
      const responseTimeMs = Math.round(performance.now() - start);
      const message = error instanceof Error ? error.message : 'Unknown S3 error';
      throw new HealthCheckError(
        `${key} health check failed`,
        this.getStatus(key, false, { responseTimeMs, message }),
      );
    }
  }
}
