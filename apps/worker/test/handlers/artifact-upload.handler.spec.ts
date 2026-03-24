import { Test } from '@nestjs/testing';
import { RetryableError, S3Service } from '@spechive/nestjs-common';
import type { ArtifactId, RunId, TestId } from '@spechive/shared-types';
import { ArtifactType } from '@spechive/shared-types';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createHandlerContext } from '../../../../test/unit-helpers/handler-context';
import { ArtifactUploadHandler } from '../../src/modules/result-processor/handlers/artifact-upload.handler';

describe('ArtifactUploadHandler', () => {
  let handler: ArtifactUploadHandler;
  let ctx: ReturnType<typeof createHandlerContext>['ctx'];
  let mocks: ReturnType<typeof createHandlerContext>['mocks'];
  let mockHeadObject: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    ({ ctx, mocks } = createHandlerContext());
    mockHeadObject = vi.fn().mockResolvedValue({ exists: true, contentLength: 1024 });

    const module = await Test.createTestingModule({
      providers: [
        ArtifactUploadHandler,
        { provide: S3Service, useValue: { headObject: mockHeadObject } },
      ],
    }).compile();

    handler = module.get(ArtifactUploadHandler);
  });

  it('verifies S3 object via HEAD and inserts artifact row with correct sizeBytes', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'artifact.upload' as const,
      payload: {
        artifactId: 'artifact-1' as ArtifactId,
        testId: 'test-1' as TestId,
        artifactType: ArtifactType.Screenshot,
        name: 'failure.png',
        storagePath: `org-1/proj-1/run-1/test-1/artifact-1_failure.png`,
        mimeType: 'image/png',
      },
    };

    await handler.handle(event, ctx);

    expect(mockHeadObject).toHaveBeenCalledWith(event.payload.storagePath);
    expect(mocks.insert.insert).toHaveBeenCalled();
    expect(mocks.insert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'artifact-1',
        testId: 'test-1',
        organizationId: 'org-1',
        type: ArtifactType.Screenshot,
        name: 'failure.png',
        sizeBytes: 1024,
        mimeType: 'image/png',
      }),
    );
  });

  it('returns without inserting when storage path prefix does not match', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'artifact.upload' as const,
      payload: {
        artifactId: 'artifact-1' as ArtifactId,
        testId: 'test-1' as TestId,
        artifactType: ArtifactType.Log,
        name: 'output.log',
        storagePath: 'wrong-org/wrong-proj/run-1/test-1/artifact-1_output.log',
      },
    };

    await handler.handle(event, ctx);

    expect(mockHeadObject).not.toHaveBeenCalled();
    expect(mocks.insert.insert).not.toHaveBeenCalled();
  });

  it('throws retryable error when S3 HEAD returns NotFound', async () => {
    mockHeadObject.mockResolvedValue({ exists: false });

    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'artifact.upload' as const,
      payload: {
        artifactId: 'artifact-1' as ArtifactId,
        testId: 'test-1' as TestId,
        artifactType: ArtifactType.Screenshot,
        name: 'failure.png',
        storagePath: `org-1/proj-1/run-1/test-1/artifact-1_failure.png`,
      },
    };

    await expect(handler.handle(event, ctx)).rejects.toThrow(RetryableError);
    expect(mocks.insert.insert).not.toHaveBeenCalled();
  });

  it('propagates transient S3 errors', async () => {
    mockHeadObject.mockRejectedValue(new Error('S3 unavailable'));

    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'artifact.upload' as const,
      payload: {
        artifactId: 'artifact-1' as ArtifactId,
        testId: 'test-1' as TestId,
        artifactType: ArtifactType.Other,
        name: 'data.bin',
        storagePath: `org-1/proj-1/run-1/test-1/artifact-1_data.bin`,
      },
    };

    await expect(handler.handle(event, ctx)).rejects.toThrow('S3 unavailable');
    expect(mocks.insert.insert).not.toHaveBeenCalled();
  });
});
