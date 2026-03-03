import { HeadBucketCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { HealthCheckError } from '@nestjs/terminus';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { S3HealthIndicator } from '../src/health/indicators/s3-health.indicator';

describe('S3HealthIndicator', () => {
  let indicator: S3HealthIndicator;
  let mockSend: ReturnType<typeof vi.fn>;
  let mockClient: S3Client;
  const TEST_BUCKET = 'test-bucket';

  beforeEach(() => {
    mockSend = vi.fn().mockResolvedValue({});
    mockClient = { send: mockSend } as unknown as S3Client;
    indicator = new S3HealthIndicator(mockClient, TEST_BUCKET);
  });

  describe('isAvailable', () => {
    it('returns true when S3Client and bucket are injected', () => {
      expect(indicator.isAvailable()).toBe(true);
    });

    it('returns false when S3Client is not injected', () => {
      const noClientIndicator = new S3HealthIndicator(undefined, TEST_BUCKET);
      expect(noClientIndicator.isAvailable()).toBe(false);
    });

    it('returns false when bucket is not injected', () => {
      const noBucketIndicator = new S3HealthIndicator(mockClient, undefined);
      expect(noBucketIndicator.isAvailable()).toBe(false);
    });

    it('returns false when neither is injected', () => {
      const emptyIndicator = new S3HealthIndicator();
      expect(emptyIndicator.isAvailable()).toBe(false);
    });
  });

  describe('isHealthy', () => {
    it('returns healthy with responseTimeMs on successful HeadBucket', async () => {
      const result = await indicator.isHealthy('storage');

      expect(result.storage.status).toBe('up');
      expect(result.storage.responseTimeMs).toBeTypeOf('number');
      expect(mockSend).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
    });

    it('throws HealthCheckError on S3 error', async () => {
      mockSend.mockRejectedValue(new Error('Bucket not found'));

      await expect(indicator.isHealthy('storage')).rejects.toThrow(HealthCheckError);
    });

    it('includes error message in unhealthy status', async () => {
      mockSend.mockRejectedValue(new Error('Access denied'));

      try {
        await indicator.isHealthy('storage');
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        const causes = (error as HealthCheckError).causes;
        expect(causes.storage.status).toBe('down');
        expect(causes.storage.message).toBe('Access denied');
      }
    });

    it('returns healthy when S3 is not configured', async () => {
      const noS3 = new S3HealthIndicator();
      const result = await noS3.isHealthy('storage');

      expect(result.storage.status).toBe('up');
      expect(result.storage.message).toBe('S3 not configured');
    });
  });
});
