import { AllExceptionsFilter, IS_PRODUCTION, S3Service } from '@assertly/nestjs-common';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

import { ProjectTokenGuard } from '../src/guards/project-token.guard';
import type { ProjectContext } from '../src/guards/project-token.guard';
import { ArtifactsController } from '../src/modules/artifacts/artifacts.controller';
import { ArtifactsService } from '../src/modules/artifacts/artifacts.service';

const MOCK_PROJECT_CONTEXT: ProjectContext = {
  projectId: 'project-abc' as ProjectContext['projectId'],
  organizationId: '00000000-0000-4000-a000-000000000099' as ProjectContext['organizationId'],
};

describe('ArtifactsController', () => {
  let app: NestFastifyApplication;
  let mockGetPresignedUploadUrl: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    mockGetPresignedUploadUrl = vi.fn().mockResolvedValue('https://s3.example.com/presigned-url');

    class MockProjectTokenGuard {
      canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        request.projectContext = MOCK_PROJECT_CONTEXT;
        return true;
      }
    }

    class MockThrottlerGuard {
      canActivate(): boolean {
        return true;
      }
    }

    const mockConfigService = {
      get: vi.fn().mockReturnValue('development'),
      getOrThrow: vi.fn().mockReturnValue('development'),
    };

    const moduleFixture = await Test.createTestingModule({
      controllers: [ArtifactsController],
      providers: [
        ArtifactsService,
        { provide: S3Service, useValue: { getPresignedUploadUrl: mockGetPresignedUploadUrl } },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: IS_PRODUCTION, useValue: false },
        { provide: DATABASE_CONNECTION, useValue: {} },
        { provide: ProjectTokenGuard, useClass: MockProjectTokenGuard },
        { provide: ThrottlerGuard, useClass: MockThrottlerGuard },
        {
          provide: APP_FILTER,
          useFactory: () => new AllExceptionsFilter(mockConfigService as unknown as ConfigService),
        },
      ],
    })
      .overrideGuard(ProjectTokenGuard)
      .useClass(MockProjectTokenGuard)
      .overrideGuard(ThrottlerGuard)
      .useClass(MockThrottlerGuard)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/artifacts/presign with valid body returns 201', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/artifacts/presign',
      payload: {
        runId: '00000000-0000-4000-8000-000000000001',
        testId: '00000000-0000-4000-8000-000000000002',
        fileName: 'screenshot.png',
        contentType: 'image/png',
        sizeBytes: 1024,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.artifactId).toBeDefined();
    expect(body.storagePath).toBeDefined();
    expect(body.uploadUrl).toBe('https://s3.example.com/presigned-url');
    expect(body.expiresIn).toBe(300);
  });

  it('POST /v1/artifacts/presign with sizeBytes > 10MB returns 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/artifacts/presign',
      payload: {
        runId: '00000000-0000-4000-8000-000000000001',
        testId: '00000000-0000-4000-8000-000000000002',
        fileName: 'large-file.bin',
        contentType: 'application/octet-stream',
        sizeBytes: 10_485_761,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /v1/artifacts/presign with missing required fields returns 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/artifacts/presign',
      payload: {
        runId: '00000000-0000-4000-8000-000000000001',
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
