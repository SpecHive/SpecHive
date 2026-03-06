import { S3Service } from '@assertly/nestjs-common';
import type { ArtifactId, OrganizationId, ProjectId, RunId, TestId } from '@assertly/shared-types';
import { ArtifactType } from '@assertly/shared-types';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ArtifactUploadHandler } from '../../src/modules/result-processor/handlers/artifact-upload.handler';
import type { EventHandlerContext } from '../../src/modules/result-processor/handlers/event-handler.interface';

describe('ArtifactUploadHandler', () => {
  let handler: ArtifactUploadHandler;
  let mockInsert: ReturnType<typeof vi.fn>;
  let mockHeadObject: ReturnType<typeof vi.fn>;
  let ctx: EventHandlerContext;

  const ORG_ID = 'org-1' as OrganizationId;
  const PROJECT_ID = 'proj-1' as ProjectId;

  beforeEach(async () => {
    mockInsert = vi.fn().mockReturnValue({ values: vi.fn() });
    mockHeadObject = vi.fn().mockResolvedValue({ exists: true, contentLength: 1024 });

    ctx = {
      tx: { insert: mockInsert } as unknown as EventHandlerContext['tx'],
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
    };

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
        storagePath: `${ORG_ID}/${PROJECT_ID}/run-1/test-1/artifact-1_failure.png`,
        mimeType: 'image/png',
      },
    };

    await handler.handle(event, ctx);

    expect(mockHeadObject).toHaveBeenCalledWith(event.payload.storagePath);
    expect(mockInsert).toHaveBeenCalled();
    const valuesCall = mockInsert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'artifact-1',
        testId: 'test-1',
        organizationId: ORG_ID,
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
    expect(mockInsert).not.toHaveBeenCalled();
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
        storagePath: `${ORG_ID}/${PROJECT_ID}/run-1/test-1/artifact-1_failure.png`,
      },
    };

    await expect(handler.handle(event, ctx)).rejects.toThrow('not found in S3');
    expect(mockInsert).not.toHaveBeenCalled();
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
        storagePath: `${ORG_ID}/${PROJECT_ID}/run-1/test-1/artifact-1_data.bin`,
      },
    };

    await expect(handler.handle(event, ctx)).rejects.toThrow('S3 unavailable');
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
