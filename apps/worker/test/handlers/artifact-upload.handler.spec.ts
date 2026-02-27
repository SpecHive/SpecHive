import { S3Service } from '@assertly/nestjs-common';
import type { OrganizationId, ProjectId, RunId, TestId } from '@assertly/shared-types';
import { ArtifactType } from '@assertly/shared-types';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ArtifactUploadHandler } from '../../src/modules/result-processor/handlers/artifact-upload.handler';
import type { EventHandlerContext } from '../../src/modules/result-processor/handlers/event-handler.interface';

describe('ArtifactUploadHandler', () => {
  let handler: ArtifactUploadHandler;
  let mockInsert: ReturnType<typeof vi.fn>;
  let mockS3Upload: ReturnType<typeof vi.fn>;
  let ctx: EventHandlerContext;

  beforeEach(async () => {
    mockInsert = vi.fn().mockReturnValue({ values: vi.fn() });
    mockS3Upload = vi.fn().mockResolvedValue(undefined);

    ctx = {
      tx: { insert: mockInsert } as unknown as EventHandlerContext['tx'],
      organizationId: 'org-1' as OrganizationId,
      projectId: 'proj-1' as ProjectId,
    };

    const module = await Test.createTestingModule({
      providers: [
        ArtifactUploadHandler,
        { provide: S3Service, useValue: { upload: mockS3Upload } },
      ],
    }).compile();

    handler = module.get(ArtifactUploadHandler);
  });

  it('uploads to S3 and inserts artifact with correct fields', async () => {
    const data = Buffer.from('test-image').toString('base64');
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'artifact.upload' as const,
      payload: {
        testId: 'test-1' as TestId,
        artifactType: ArtifactType.Screenshot,
        name: 'failure.png',
        data,
        mimeType: 'image/png',
      },
    };

    await handler.handle(event, ctx);

    expect(mockS3Upload).toHaveBeenCalledOnce();
    const [storagePath, buffer, mimeType] = mockS3Upload.mock.calls[0];
    expect(storagePath).toContain('org-1/proj-1/run-1/test-1/');
    expect(storagePath).toContain('failure.png');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBe(Buffer.from('test-image').length);
    expect(mimeType).toBe('image/png');

    expect(mockInsert).toHaveBeenCalled();
    const valuesCall = mockInsert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        testId: 'test-1',
        organizationId: 'org-1',
        type: ArtifactType.Screenshot,
        name: 'failure.png',
        sizeBytes: Buffer.from('test-image').length,
        mimeType: 'image/png',
      }),
    );
  });

  it('inserts artifact with pending:// path on S3 failure', async () => {
    mockS3Upload.mockRejectedValue(new Error('S3 unavailable'));
    const data = Buffer.from('test').toString('base64');
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'artifact.upload' as const,
      payload: {
        testId: 'test-1' as TestId,
        artifactType: ArtifactType.Log,
        name: 'output.log',
        data,
      },
    };

    await handler.handle(event, ctx);

    expect(mockInsert).toHaveBeenCalled();
    const valuesCall = mockInsert.mock.results[0].value.values;
    const insertedValues = valuesCall.mock.calls[0][0];
    expect(insertedValues.storagePath).toMatch(/^pending:\/\//);
    expect(insertedValues.mimeType).toBeNull();
  });

  it('computes sizeBytes from decoded buffer', async () => {
    const rawData = 'hello-world-test-data';
    const data = Buffer.from(rawData).toString('base64');
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'artifact.upload' as const,
      payload: {
        testId: 'test-1' as TestId,
        artifactType: ArtifactType.Other,
        name: 'data.bin',
        data,
      },
    };

    await handler.handle(event, ctx);

    const valuesCall = mockInsert.mock.results[0].value.values;
    const insertedValues = valuesCall.mock.calls[0][0];
    expect(insertedValues.sizeBytes).toBe(Buffer.from(rawData).length);
  });
});
