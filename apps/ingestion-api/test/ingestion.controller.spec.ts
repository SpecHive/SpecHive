import { ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DATABASE_CONNECTION } from '@spechive/nestjs-common';
import { AllExceptionsFilter, IS_PRODUCTION } from '@spechive/nestjs-common';
import { ProjectTokenGuard } from '@spechive/nestjs-common';
import type { ProjectContext } from '@spechive/nestjs-common';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';

import { MockProjectTokenGuard, MockThrottlerGuard } from '../../../test/unit-helpers/mock-guards';
import { IngestionController } from '../src/modules/ingestion/ingestion.controller';
import { IngestionService } from '../src/modules/ingestion/ingestion.service';

const MOCK_PROJECT_CONTEXT: ProjectContext = {
  projectId: 'project-abc' as ProjectContext['projectId'],
  organizationId: '00000000-0000-4000-a000-000000000099' as ProjectContext['organizationId'],
};

const VALID_PAYLOAD = {
  version: '1',
  timestamp: '2026-02-24T10:00:00.000Z',
  runId: '00000000-0000-4000-8000-000000000001',
  eventType: 'run.start',
  payload: {},
};

function buildModule(nodeEnv: string) {
  const mockProcessEvent = vi.fn().mockResolvedValue({ eventId: 'evt-mock-id' });

  const mockConfigService = {
    get: vi.fn().mockReturnValue(nodeEnv),
    getOrThrow: vi.fn().mockReturnValue(nodeEnv),
  };

  return {
    mockProcessEvent,
    moduleBuilder: Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        {
          provide: IngestionService,
          useValue: { processEvent: mockProcessEvent },
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        { provide: IS_PRODUCTION, useValue: nodeEnv === 'production' },
        {
          provide: DATABASE_CONNECTION,
          useValue: {},
        },
        {
          provide: ProjectTokenGuard,
          useClass: MockProjectTokenGuard,
        },
        {
          provide: ThrottlerGuard,
          useClass: MockThrottlerGuard,
        },
        {
          provide: APP_FILTER,
          useFactory: () => new AllExceptionsFilter(mockConfigService as unknown as ConfigService),
        },
      ],
    })
      .overrideGuard(ProjectTokenGuard)
      .useClass(MockProjectTokenGuard)
      .overrideGuard(ThrottlerGuard)
      .useClass(MockThrottlerGuard),
  };
}

describe('IngestionController', () => {
  describe('development mode', () => {
    let app: NestFastifyApplication;
    let mockProcessEvent: ReturnType<typeof vi.fn>;

    beforeAll(async () => {
      const { mockProcessEvent: mock, moduleBuilder } = buildModule('development');
      mockProcessEvent = mock;

      const moduleFixture = await moduleBuilder.compile();

      app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('POST /v1/events with valid payload returns 202 Accepted', async () => {
      mockProcessEvent.mockResolvedValue({ eventId: 'evt-mock-id' });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events',
        payload: VALID_PAYLOAD,
      });

      expect(response.statusCode).toBe(202);
      expect(mockProcessEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'run.start' }),
        MOCK_PROJECT_CONTEXT.projectId,
        MOCK_PROJECT_CONTEXT.organizationId,
      );
    });

    describe('event type routing', () => {
      const RUN_ID = '00000000-0000-4000-8000-000000000001';
      const SUITE_ID = '00000000-0000-4000-a000-000000000010';
      const TEST_ID = '00000000-0000-4000-a000-000000000020';
      const TIMESTAMP = '2026-02-24T10:00:00.000Z';

      beforeEach(() => {
        mockProcessEvent.mockResolvedValue({ eventId: 'evt-mock-id' });
      });

      it('routes run.end and returns 202', async () => {
        const payload = {
          version: '1',
          timestamp: TIMESTAMP,
          runId: RUN_ID,
          eventType: 'run.end',
          payload: { status: 'passed' },
        };

        const response = await app.inject({ method: 'POST', url: '/v1/events', payload });

        expect(response.statusCode).toBe(202);
        expect(mockProcessEvent).toHaveBeenCalledWith(
          expect.objectContaining({ eventType: 'run.end' }),
          MOCK_PROJECT_CONTEXT.projectId,
          MOCK_PROJECT_CONTEXT.organizationId,
        );
      });

      it('routes suite.start and returns 202', async () => {
        const payload = {
          version: '1',
          timestamp: TIMESTAMP,
          runId: RUN_ID,
          eventType: 'suite.start',
          payload: { suiteId: SUITE_ID, suiteName: 'Suite' },
        };

        const response = await app.inject({ method: 'POST', url: '/v1/events', payload });

        expect(response.statusCode).toBe(202);
        expect(mockProcessEvent).toHaveBeenCalledWith(
          expect.objectContaining({ eventType: 'suite.start' }),
          MOCK_PROJECT_CONTEXT.projectId,
          MOCK_PROJECT_CONTEXT.organizationId,
        );
      });

      it('routes suite.end and returns 202', async () => {
        const payload = {
          version: '1',
          timestamp: TIMESTAMP,
          runId: RUN_ID,
          eventType: 'suite.end',
          payload: { suiteId: SUITE_ID },
        };

        const response = await app.inject({ method: 'POST', url: '/v1/events', payload });

        expect(response.statusCode).toBe(202);
        expect(mockProcessEvent).toHaveBeenCalledWith(
          expect.objectContaining({ eventType: 'suite.end' }),
          MOCK_PROJECT_CONTEXT.projectId,
          MOCK_PROJECT_CONTEXT.organizationId,
        );
      });

      it('routes test.start and returns 202', async () => {
        const payload = {
          version: '1',
          timestamp: TIMESTAMP,
          runId: RUN_ID,
          eventType: 'test.start',
          payload: { testId: TEST_ID, suiteId: SUITE_ID, testName: 'test' },
        };

        const response = await app.inject({ method: 'POST', url: '/v1/events', payload });

        expect(response.statusCode).toBe(202);
        expect(mockProcessEvent).toHaveBeenCalledWith(
          expect.objectContaining({ eventType: 'test.start' }),
          MOCK_PROJECT_CONTEXT.projectId,
          MOCK_PROJECT_CONTEXT.organizationId,
        );
      });

      it('routes test.end and returns 202', async () => {
        const payload = {
          version: '1',
          timestamp: TIMESTAMP,
          runId: RUN_ID,
          eventType: 'test.end',
          payload: { testId: TEST_ID, status: 'passed', durationMs: 100 },
        };

        const response = await app.inject({ method: 'POST', url: '/v1/events', payload });

        expect(response.statusCode).toBe(202);
        expect(mockProcessEvent).toHaveBeenCalledWith(
          expect.objectContaining({ eventType: 'test.end' }),
          MOCK_PROJECT_CONTEXT.projectId,
          MOCK_PROJECT_CONTEXT.organizationId,
        );
      });

      it('routes artifact.upload and returns 202', async () => {
        const payload = {
          version: '1',
          timestamp: TIMESTAMP,
          runId: RUN_ID,
          eventType: 'artifact.upload',
          payload: {
            artifactId: '00000000-0000-4000-a000-000000000030',
            testId: TEST_ID,
            artifactType: 'screenshot',
            name: 'img.png',
            storagePath: 'org/proj/run/test/artifact_img.png',
          },
        };

        const response = await app.inject({ method: 'POST', url: '/v1/events', payload });

        expect(response.statusCode).toBe(202);
        expect(mockProcessEvent).toHaveBeenCalledWith(
          expect.objectContaining({ eventType: 'artifact.upload' }),
          MOCK_PROJECT_CONTEXT.projectId,
          MOCK_PROJECT_CONTEXT.organizationId,
        );
      });
    });

    it('POST /v1/events with invalid schema returns 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events',
        payload: { totally: 'wrong' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('error response shape matches { statusCode, message, timestamp }', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events',
        payload: { totally: 'wrong' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload) as Record<string, unknown>;
      expect(typeof body['statusCode']).toBe('number');
      expect(body['statusCode']).toBe(400);
      expect(typeof body['message']).toBe('string');
      expect(typeof body['timestamp']).toBe('string');
      expect(new Date(body['timestamp'] as string).toISOString()).toBe(body['timestamp']);
    });

    it('development mode includes Zod details in the error message', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events',
        payload: { totally: 'wrong' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload) as Record<string, unknown>;
      const message = body['message'] as string;
      expect(message).toContain('Invalid event payload:');
      // Zod flatten output includes fieldErrors or formErrors keys
      expect(message.length).toBeGreaterThan('Invalid event payload:'.length);
    });

    it('GET /v1/capabilities returns supported versions and event types', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/capabilities',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toEqual({
        supportedVersions: ['1'],
        currentVersion: '1',
        eventTypes: [
          'run.start',
          'run.end',
          'suite.start',
          'suite.end',
          'test.start',
          'test.end',
          'artifact.upload',
        ],
      });
    });
  });

  describe('production mode', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      const { moduleBuilder } = buildModule('production');

      const moduleFixture = await moduleBuilder.compile();

      app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('production mode hides Zod details and returns generic message', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events',
        payload: { totally: 'wrong' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload) as Record<string, unknown>;
      expect(body['message']).toBe('Invalid event payload');
    });
  });
});
