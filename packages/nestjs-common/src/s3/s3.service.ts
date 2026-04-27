import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable } from '@nestjs/common';
import type { Counter, Histogram } from 'prom-client';

import { METRICS_SERVICE } from '../metrics/metrics.constants';
import { MetricsService } from '../metrics/metrics.service';

import { S3_BUCKET, S3_CLIENT, S3_PRESIGNER_CLIENT } from './s3.constants';

const DEFAULT_PRESIGNED_EXPIRY_SECONDS = 900;

@Injectable()
export class S3Service {
  private readonly s3Duration: Histogram<string>;
  private readonly s3Total: Counter<string>;

  constructor(
    @Inject(S3_CLIENT) private readonly client: S3Client,
    @Inject(S3_PRESIGNER_CLIENT) private readonly presignerClient: S3Client,
    @Inject(S3_BUCKET) private readonly bucket: string,
    @Inject(METRICS_SERVICE) metrics: MetricsService,
  ) {
    this.s3Duration = metrics.createHistogram(
      'spechive_s3_operation_duration_seconds',
      'S3 operation duration in seconds',
      ['operation', 'status'],
    );
    this.s3Total = metrics.createCounter('spechive_s3_operations_total', 'Total S3 operations', [
      'operation',
      'status',
    ]);
  }

  async upload(key: string, body: Buffer | string, contentType?: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ...(contentType ? { ContentType: contentType } : {}),
    });
    await this.timed('upload', () => this.client.send(command));
  }

  async getPresignedDownloadUrl(key: string, expiresIn?: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return this.timed('presign_download', () =>
      getSignedUrl(this.presignerClient, command, {
        expiresIn: expiresIn ?? DEFAULT_PRESIGNED_EXPIRY_SECONDS,
      }),
    );
  }

  async getPresignedUploadUrl(key: string, contentType: string, expiresIn = 300): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return this.timed('presign_upload', () =>
      getSignedUrl(this.presignerClient, command, { expiresIn }),
    );
  }

  async headObject(key: string): Promise<{ exists: boolean; contentLength?: number | undefined }> {
    const start = performance.now();
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      this.recordMetrics('head', start, 'success');
      return { exists: true, contentLength: response.ContentLength };
    } catch (error: unknown) {
      if (error instanceof Error && (error.name === 'NotFound' || error.name === 'NoSuchKey')) {
        // NotFound is a successful S3 operation (object doesn't exist, not an infrastructure error)
        this.recordMetrics('head', start, 'success');
        return { exists: false };
      }
      this.recordMetrics('head', start, 'error');
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.timed('delete', () => this.client.send(command));
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    const BATCH_SIZE = 1000;
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);
      const command = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: true,
        },
      });

      await this.timed('delete_many', async () => {
        const response = await this.client.send(command);
        if (response.Errors && response.Errors.length > 0) {
          const failedKeys = response.Errors.map((e) => e.Key ?? 'unknown').join(', ');
          throw new Error(
            `Failed to delete ${response.Errors.length} object(s) from S3: ${failedKeys}`,
          );
        }
        return response;
      });
    }
  }

  private recordMetrics(operation: string, start: number, status: string): void {
    const durationSeconds = (performance.now() - start) / 1000;
    this.s3Duration.observe({ operation, status }, durationSeconds);
    this.s3Total.inc({ operation, status });
  }

  private async timed<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      this.recordMetrics(operation, start, 'success');
      return result;
    } catch (error) {
      this.recordMetrics(operation, start, 'error');
      throw error;
    }
  }
}
