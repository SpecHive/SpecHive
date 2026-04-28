import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { MetricsService } from '../src/metrics/metrics.service';
import { S3Service } from '../src/s3/s3.service';

const mockHistogram = { observe: vi.fn() };
const mockCounter = { inc: vi.fn() };

function createMockMetrics(): MetricsService {
  return {
    createHistogram: vi.fn().mockReturnValue(mockHistogram),
    createCounter: vi.fn().mockReturnValue(mockCounter),
  } as unknown as MetricsService;
}

const { mockSend, mockPresignerSend, mockGetSignedUrl } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({}),
  mockPresignerSend: vi.fn().mockResolvedValue({}),
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
  DeleteObjectsCommand: vi.fn().mockImplementation(function (
    this: Record<string, unknown>,
    input: Record<string, unknown>,
  ) {
    Object.assign(this, input, { _type: 'DeleteObjects' });
  }),
  HeadObjectCommand: vi.fn().mockImplementation(function (
    this: Record<string, unknown>,
    input: Record<string, unknown>,
  ) {
    Object.assign(this, input, { _type: 'HeadObject' });
  }),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

describe('S3Service', () => {
  let service: S3Service;
  const TEST_BUCKET = 'test-bucket';
  let mockClient: S3Client;
  let mockPresignerClient: S3Client;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = { send: mockSend } as unknown as S3Client;
    mockPresignerClient = { send: mockPresignerSend } as unknown as S3Client;
    service = new S3Service(mockClient, mockPresignerClient, TEST_BUCKET, createMockMetrics());
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
      expect(mockGetSignedUrl).toHaveBeenCalledWith(mockPresignerClient, expect.anything(), {
        expiresIn: 900,
      });
      expect(url).toBe('https://signed-url.example.com/file');
    });

    it('uses custom expiry when provided', async () => {
      await service.getPresignedDownloadUrl('artifacts/file.txt', 3600);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(mockPresignerClient, expect.anything(), {
        expiresIn: 3600,
      });
    });

    it('does not use the main client for signing', async () => {
      await service.getPresignedDownloadUrl('artifacts/file.txt');

      expect(mockGetSignedUrl).not.toHaveBeenCalledWith(
        mockClient,
        expect.anything(),
        expect.anything(),
      );
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

  describe('deleteMany', () => {
    it('does not call send for empty array', async () => {
      await service.deleteMany([]);

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('sends single DeleteObjectsCommand for 3 keys', async () => {
      mockSend.mockResolvedValueOnce({ Errors: [] });
      const keys = ['file1.txt', 'file2.txt', 'file3.txt'];

      await service.deleteMany(keys);

      expect(DeleteObjectsCommand).toHaveBeenCalledWith({
        Bucket: TEST_BUCKET,
        Delete: {
          Objects: [{ Key: 'file1.txt' }, { Key: 'file2.txt' }, { Key: 'file3.txt' }],
          Quiet: true,
        },
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('batches into chunks of 1000', async () => {
      mockSend.mockResolvedValue({ Errors: [] });
      const keys = Array.from({ length: 1001 }, (_, i) => `file-${i}.txt`);

      await service.deleteMany(keys);

      expect(mockSend).toHaveBeenCalledTimes(2);
      const firstCall = vi.mocked(DeleteObjectsCommand).mock.calls[0][0];
      const secondCall = vi.mocked(DeleteObjectsCommand).mock.calls[1][0];
      expect(firstCall.Delete!.Objects).toHaveLength(1000);
      expect(secondCall.Delete!.Objects).toHaveLength(1);
    });

    it('throws when response contains errors with failed key names', async () => {
      mockSend.mockResolvedValueOnce({
        Errors: [{ Key: 'file1.txt', Code: 'AccessDenied' }],
      });

      await expect(service.deleteMany(['file1.txt'])).rejects.toThrow(
        'Failed to delete 1 object(s) from S3: file1.txt',
      );
    });

    it('includes all failed keys in error message', async () => {
      mockSend.mockResolvedValueOnce({
        Errors: [
          { Key: 'a.txt', Code: 'AccessDenied' },
          { Key: 'b.txt', Code: 'InternalError' },
        ],
      });

      await expect(service.deleteMany(['a.txt', 'b.txt'])).rejects.toThrow(
        'Failed to delete 2 object(s) from S3: a.txt, b.txt',
      );
    });
  });

  describe('metrics', () => {
    beforeEach(() => {
      mockHistogram.observe.mockClear();
      mockCounter.inc.mockClear();
    });

    it('records duration and success counter on upload', async () => {
      await service.upload('key', Buffer.from('data'));

      expect(mockHistogram.observe).toHaveBeenCalledWith(
        { operation: 'upload', status: 'success' },
        expect.any(Number),
      );
      expect(mockCounter.inc).toHaveBeenCalledWith({ operation: 'upload', status: 'success' });
    });

    it('records error counter on failed upload', async () => {
      mockSend.mockRejectedValueOnce(new Error('S3 down'));

      await expect(service.upload('key', Buffer.from('data'))).rejects.toThrow('S3 down');

      expect(mockCounter.inc).toHaveBeenCalledWith({ operation: 'upload', status: 'error' });
      expect(mockHistogram.observe).toHaveBeenCalledWith(
        { operation: 'upload', status: 'error' },
        expect.any(Number),
      );
    });

    it('headObject records success for NotFound', async () => {
      const notFound = new Error('NotFound');
      notFound.name = 'NotFound';
      mockSend.mockRejectedValueOnce(notFound);

      const result = await service.headObject('missing-key');

      expect(result).toEqual({ exists: false });
      expect(mockCounter.inc).toHaveBeenCalledWith({ operation: 'head', status: 'success' });
    });

    it('headObject records success for NoSuchKey', async () => {
      const err = new Error('NoSuchKey');
      err.name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(err);

      const result = await service.headObject('missing-key');

      expect(result).toEqual({ exists: false });
      expect(mockCounter.inc).toHaveBeenCalledWith({ operation: 'head', status: 'success' });
    });

    it('headObject records error for unexpected errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network failure'));

      await expect(service.headObject('key')).rejects.toThrow('Network failure');

      expect(mockCounter.inc).toHaveBeenCalledWith({ operation: 'head', status: 'error' });
    });

    it('deleteMany records status=error when response contains partial failures', async () => {
      mockSend.mockResolvedValueOnce({
        Errors: [{ Key: 'a.txt', Code: 'AccessDenied' }],
      });

      await expect(service.deleteMany(['a.txt'])).rejects.toThrow(
        'Failed to delete 1 object(s) from S3',
      );

      expect(mockCounter.inc).toHaveBeenCalledWith({
        operation: 'delete_many',
        status: 'error',
      });
      expect(mockCounter.inc).not.toHaveBeenCalledWith({
        operation: 'delete_many',
        status: 'success',
      });
    });

    it('deleteMany records status=success when all batches succeed', async () => {
      mockSend.mockResolvedValueOnce({ Errors: [] });

      await service.deleteMany(['ok.txt']);

      expect(mockCounter.inc).toHaveBeenCalledWith({
        operation: 'delete_many',
        status: 'success',
      });
    });
  });
});
