import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable } from '@nestjs/common';

import { S3_BUCKET, S3_CLIENT, S3_PRESIGNER_CLIENT } from './s3.constants';

const DEFAULT_PRESIGNED_EXPIRY_SECONDS = 900;

@Injectable()
export class S3Service {
  constructor(
    @Inject(S3_CLIENT) private readonly client: S3Client,
    @Inject(S3_PRESIGNER_CLIENT) private readonly presignerClient: S3Client,
    @Inject(S3_BUCKET) private readonly bucket: string,
  ) {}

  async upload(key: string, body: Buffer | string, contentType?: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ...(contentType ? { ContentType: contentType } : {}),
    });
    await this.client.send(command);
  }

  async getPresignedDownloadUrl(key: string, expiresIn?: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.presignerClient, command, {
      expiresIn: expiresIn ?? DEFAULT_PRESIGNED_EXPIRY_SECONDS,
    });
  }

  async getPresignedUploadUrl(key: string, contentType: string, expiresIn = 300): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.presignerClient, command, { expiresIn });
  }

  async headObject(key: string): Promise<{ exists: boolean; contentLength?: number | undefined }> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { exists: true, contentLength: response.ContentLength };
    } catch (error: unknown) {
      if (error instanceof Error && (error.name === 'NotFound' || error.name === 'NoSuchKey')) {
        return { exists: false };
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.client.send(command);
  }
}
