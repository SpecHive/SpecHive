import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { S3Service } from '../src/s3/s3.service';

const { mockSend, mockGetSignedUrl } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({}),
  mockGetSignedUrl: vi.fn().mockResolvedValue('https://signed-url.example.com/file'),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn().mockImplementation(function (
    this: Record<string, unknown>,
    input: Record<string, unknown>,
  ) {
    Object.assign(this, input, { _type: 'PutObject' });
  }),
  GetObjectCommand: vi.fn().mockImplementation(function (
    this: Record<string, unknown>,
    input: Record<string, unknown>,
  ) {
    Object.assign(this, input, { _type: 'GetObject' });
  }),
  DeleteObjectCommand: vi.fn().mockImplementation(function (
    this: Record<string, unknown>,
    input: Record<string, unknown>,
  ) {
    Object.assign(this, input, { _type: 'DeleteObject' });
  }),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

describe('S3Service', () => {
  let service: S3Service;
  const TEST_BUCKET = 'test-bucket';

  beforeEach(() => {
    vi.clearAllMocks();
    const mockClient = { send: mockSend } as unknown as S3Client;
    service = new S3Service(mockClient, TEST_BUCKET);
  });

  describe('upload', () => {
    it('sends PutObjectCommand with correct bucket and key', async () => {
      await service.upload('artifacts/file.txt', Buffer.from('content'));

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: TEST_BUCKET,
        Key: 'artifacts/file.txt',
        Body: Buffer.from('content'),
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('includes ContentType when provided', async () => {
      await service.upload('artifacts/image.png', Buffer.from('png-data'), 'image/png');

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: TEST_BUCKET,
        Key: 'artifacts/image.png',
        Body: Buffer.from('png-data'),
        ContentType: 'image/png',
      });
    });

    it('omits ContentType when not provided', async () => {
      await service.upload('artifacts/file.bin', Buffer.from('data'));

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: TEST_BUCKET,
        Key: 'artifacts/file.bin',
        Body: Buffer.from('data'),
      });
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('returns a signed URL with default 900s expiry', async () => {
      const url = await service.getPresignedDownloadUrl('artifacts/file.txt');

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: TEST_BUCKET,
        Key: 'artifacts/file.txt',
      });
      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        expiresIn: 900,
      });
      expect(url).toBe('https://signed-url.example.com/file');
    });

    it('uses custom expiry when provided', async () => {
      await service.getPresignedDownloadUrl('artifacts/file.txt', 3600);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        expiresIn: 3600,
      });
    });
  });

  describe('delete', () => {
    it('sends DeleteObjectCommand with correct bucket and key', async () => {
      await service.delete('artifacts/old-file.txt');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: TEST_BUCKET,
        Key: 'artifacts/old-file.txt',
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });
});
