import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const MINIO_ENDPOINT = process.env['MINIO_ENDPOINT'] ?? 'localhost:9000';
const MINIO_ACCESS_KEY = process.env['MINIO_APP_ACCESS_KEY'] ?? 'spechive-app';
const MINIO_SECRET_KEY = process.env['MINIO_APP_SECRET_KEY'] ?? 'spechive-app-secret-key';
const MINIO_BUCKET = process.env['MINIO_BUCKET'] ?? 'spechive-artifacts';
const MINIO_USE_SSL = process.env['MINIO_USE_SSL'] === 'true';

describe('MinIO/S3 integration tests', () => {
  let s3Client: S3Client;
  const testPrefix = `integration-test-${Date.now()}/`;

  beforeAll(async () => {
    const protocol = MINIO_USE_SSL ? 'https' : 'http';
    s3Client = new S3Client({
      endpoint: `${protocol}://${MINIO_ENDPOINT}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: MINIO_ACCESS_KEY,
        secretAccessKey: MINIO_SECRET_KEY,
      },
      forcePathStyle: true,
    });

    try {
      await s3Client.send(
        new ListObjectsV2Command({
          Bucket: MINIO_BUCKET,
          Prefix: testPrefix,
          MaxKeys: 1,
        }),
      );
    } catch {
      throw new Error(
        `MinIO is not accessible at ${protocol}://${MINIO_ENDPOINT}. ` +
          `Start Docker services: docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d minio minio-init`,
      );
    }
  }, 15_000);

  const testKey = (name: string) => `${testPrefix}${name}`;

  async function cleanupTestObjects(): Promise<void> {
    try {
      const listResponse = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: MINIO_BUCKET,
          Prefix: testPrefix,
        }),
      );

      if (listResponse.Contents) {
        await Promise.all(
          listResponse.Contents.map((object) =>
            s3Client.send(
              new DeleteObjectCommand({
                Bucket: MINIO_BUCKET,
                Key: object.Key!,
              }),
            ),
          ),
        );
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  describe('upload and download', () => {
    const key = testKey('upload-download-test.txt');
    const content = 'Hello, MinIO!';

    afterAll(async () => {
      await cleanupTestObjects();
    });

    it('uploads an object', async () => {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: key,
          Body: content,
          ContentType: 'text/plain',
        }),
      );

      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: key,
        }),
      );

      expect(response.ContentLength).toBeGreaterThan(0);
      expect(response.ContentType).toBe('text/plain');
    });

    it('downloads an object', async () => {
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: key,
        }),
      );

      const bytes = await response.Body?.transformToByteArray();
      const downloadedContent = new TextDecoder().decode(bytes);
      expect(downloadedContent).toBe(content);
    });
  });

  describe('presigned URLs', () => {
    const key = testKey('presigned-url-test.txt');
    const content = 'Presigned URL test content';

    afterAll(async () => {
      await cleanupTestObjects();
    });

    it('generates a presigned download URL', async () => {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: key,
          Body: content,
        }),
      );

      const command = new GetObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: key,
      });
      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

      expect(presignedUrl).toContain(MINIO_ENDPOINT);
      expect(presignedUrl).toContain(key);
      expect(presignedUrl).toContain('X-Amz-Signature');

      const response = await fetch(presignedUrl);
      expect(response.ok).toBe(true);
      const downloadedContent = await response.text();
      expect(downloadedContent).toBe(content);
    });
  });

  describe('delete object', () => {
    const key = testKey('delete-test.txt');
    const content = 'This will be deleted';

    it('deletes an object', async () => {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: key,
          Body: content,
        }),
      );

      const getResponse = await s3Client.send(
        new GetObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: key,
        }),
      );
      expect(getResponse.ContentLength).toBeGreaterThan(0);

      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: key,
        }),
      );

      try {
        await s3Client.send(
          new GetObjectCommand({
            Bucket: MINIO_BUCKET,
            Key: key,
          }),
        );
        expect.fail('Object should have been deleted');
      } catch (error) {
        expect((error as { $metadata: { httpStatusCode?: number } }).$metadata.httpStatusCode).toBe(
          404,
        );
      }
    });
  });

  describe('list objects with prefix', () => {
    const prefix = testKey('list-test/');
    const keys = [`${prefix}file1.txt`, `${prefix}file2.txt`, `${prefix}subdir/file3.txt`];
    const otherKey = testKey('other-file.txt'); // Different prefix

    afterAll(async () => {
      await cleanupTestObjects();
    });

    it('lists objects with a prefix', async () => {
      await Promise.all(
        keys.map((key) =>
          s3Client.send(
            new PutObjectCommand({
              Bucket: MINIO_BUCKET,
              Key: key,
              Body: `content of ${key}`,
            }),
          ),
        ),
      );

      await s3Client.send(
        new PutObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: otherKey,
          Body: 'other content',
        }),
      );

      const response = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: MINIO_BUCKET,
          Prefix: prefix,
        }),
      );

      expect(response.KeyCount).toBe(keys.length);
      expect(response.Contents).toHaveLength(keys.length);

      const returnedKeys = response.Contents?.map((obj) => obj.Key).sort();
      const expectedKeys = keys.sort();
      expect(returnedKeys).toEqual(expectedKeys);

      expect(response.Contents?.map((obj) => obj.Key)).not.toContain(otherKey);
    });

    it('returns empty list for non-existent prefix', async () => {
      const response = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: MINIO_BUCKET,
          Prefix: testKey('non-existent-prefix/'),
        }),
      );

      expect(response.KeyCount).toBe(0);
      expect(response.Contents).toBeUndefined();
    });
  });
});
