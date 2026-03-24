import { Test } from '@nestjs/testing';
import { OUTBOXY_CLIENT } from '@outboxy/sdk-nestjs';
import { DATABASE_CONNECTION } from '@spechive/nestjs-common';
import {
  asArtifactId,
  asRunId,
  asSuiteId,
  asTestId,
  asProjectId,
  asOrganizationId,
  RunStatus,
  TestStatus,
  ArtifactType,
} from '@spechive/shared-types';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { IngestionService } from '../src/modules/ingestion/ingestion.service';

const PROJECT_ID = asProjectId('project-1');
const ORG_ID = asOrganizationId('00000000-0000-4000-a000-000000000099');
const RUN_ID = asRunId('00000000-0000-4000-a000-000000000001');
const MOCK_EVENT_ID = 'evt-mock-id';

function makeRunStartEvent(overrides: Record<string, unknown> = {}) {
  return {
    version: '1' as const,
    timestamp: '2026-02-24T10:00:00.000Z',
    runId: RUN_ID,
    eventType: 'run.start' as const,
    payload: {},
    ...overrides,
  };
}

describe('IngestionService', () => {
  let service: IngestionService;

  const mockPublish = vi.fn();
  const mockTxExecute = vi.fn().mockResolvedValue(undefined);

  const mockDb = {
    transaction: vi.fn(),
  };

  const mockOutboxy = {
    publish: mockPublish,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb({ $client: {}, execute: mockTxExecute });
    });

    mockPublish.mockResolvedValue(MOCK_EVENT_ID);

    const module = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: DATABASE_CONNECTION, useValue: mockDb },
        { provide: OUTBOXY_CLIENT, useValue: mockOutboxy },
      ],
    }).compile();

    service = module.get(IngestionService);
  });

  describe('run.start', () => {
    it('publishes enriched envelope and returns eventId', async () => {
      const event = makeRunStartEvent();
      const result = await service.processEvent(event, PROJECT_ID, ORG_ID);

      expect(result).toEqual({ eventId: MOCK_EVENT_ID });
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: 'TestRun',
          aggregateId: RUN_ID,
          eventType: 'run.start',
          payload: { event, organizationId: ORG_ID, projectId: PROJECT_ID },
        }),
        expect.anything(),
      );
    });
  });

  describe('run.end', () => {
    it('publishes enriched envelope and returns eventId', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: RUN_ID,
        eventType: 'run.end' as const,
        payload: { status: RunStatus.Passed },
      };

      const result = await service.processEvent(event, PROJECT_ID, ORG_ID);
      expect(result).toEqual({ eventId: MOCK_EVENT_ID });
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: 'TestRun',
          aggregateId: RUN_ID,
          eventType: 'run.end',
          payload: { event, organizationId: ORG_ID, projectId: PROJECT_ID },
        }),
        expect.anything(),
      );
    });
  });

  describe('suite.start', () => {
    it('publishes enriched envelope and returns eventId', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: RUN_ID,
        eventType: 'suite.start' as const,
        payload: {
          suiteId: asSuiteId('00000000-0000-4000-a000-000000000010'),
          suiteName: 'Test Suite',
        },
      };

      const result = await service.processEvent(event, PROJECT_ID, ORG_ID);
      expect(result).toEqual({ eventId: MOCK_EVENT_ID });
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: 'TestRun',
          aggregateId: RUN_ID,
          eventType: 'suite.start',
          payload: { event, organizationId: ORG_ID, projectId: PROJECT_ID },
        }),
        expect.anything(),
      );
    });
  });

  describe('suite.end', () => {
    it('publishes enriched envelope and returns eventId', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: RUN_ID,
        eventType: 'suite.end' as const,
        payload: {
          suiteId: asSuiteId('00000000-0000-4000-a000-000000000010'),
        },
      };

      const result = await service.processEvent(event, PROJECT_ID, ORG_ID);
      expect(result).toEqual({ eventId: MOCK_EVENT_ID });
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: 'TestRun',
          aggregateId: RUN_ID,
          eventType: 'suite.end',
          payload: { event, organizationId: ORG_ID, projectId: PROJECT_ID },
        }),
        expect.anything(),
      );
    });
  });

  describe('test.start', () => {
    it('publishes enriched envelope and returns eventId', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: RUN_ID,
        eventType: 'test.start' as const,
        payload: {
          testId: asTestId('00000000-0000-4000-a000-000000000020'),
          suiteId: asSuiteId('00000000-0000-4000-a000-000000000010'),
          testName: 'should pass',
        },
      };

      const result = await service.processEvent(event, PROJECT_ID, ORG_ID);
      expect(result).toEqual({ eventId: MOCK_EVENT_ID });
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: 'TestRun',
          aggregateId: RUN_ID,
          eventType: 'test.start',
          payload: { event, organizationId: ORG_ID, projectId: PROJECT_ID },
        }),
        expect.anything(),
      );
    });
  });

  describe('test.end', () => {
    it('publishes enriched envelope and returns eventId', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: RUN_ID,
        eventType: 'test.end' as const,
        payload: {
          testId: asTestId('00000000-0000-4000-a000-000000000020'),
          status: TestStatus.Passed,
          durationMs: 100,
        },
      };

      const result = await service.processEvent(event, PROJECT_ID, ORG_ID);
      expect(result).toEqual({ eventId: MOCK_EVENT_ID });
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: 'TestRun',
          aggregateId: RUN_ID,
          eventType: 'test.end',
          payload: { event, organizationId: ORG_ID, projectId: PROJECT_ID },
        }),
        expect.anything(),
      );
    });
  });

  describe('artifact.upload', () => {
    it('publishes enriched envelope and returns eventId', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: RUN_ID,
        eventType: 'artifact.upload' as const,
        payload: {
          artifactId: asArtifactId('00000000-0000-4000-a000-000000000030'),
          testId: asTestId('00000000-0000-4000-a000-000000000020'),
          artifactType: ArtifactType.Screenshot,
          name: 'failure.png',
          storagePath: 'org/proj/run/test/artifact_failure.png',
        },
      };

      const result = await service.processEvent(event, PROJECT_ID, ORG_ID);
      expect(result).toEqual({ eventId: MOCK_EVENT_ID });
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: 'TestRun',
          aggregateId: RUN_ID,
          eventType: 'artifact.upload',
          payload: { event, organizationId: ORG_ID, projectId: PROJECT_ID },
        }),
        expect.anything(),
      );
    });
  });

  describe('transaction rollback', () => {
    it('rejects when outboxy.publish() throws', async () => {
      mockPublish.mockRejectedValue(new Error('Outbox publish failed'));

      await expect(service.processEvent(makeRunStartEvent(), PROJECT_ID, ORG_ID)).rejects.toThrow(
        'Outbox publish failed',
      );
    });
  });

  describe('idempotency key', () => {
    it('sends the same idempotency key for the same event processed twice', async () => {
      const event = makeRunStartEvent();

      await service.processEvent(event, PROJECT_ID, ORG_ID);
      await service.processEvent(event, PROJECT_ID, ORG_ID);

      expect(mockPublish).toHaveBeenCalledTimes(2);

      const [firstCall, secondCall] = mockPublish.mock.calls as [
        [{ idempotencyKey: string }, unknown],
        [{ idempotencyKey: string }, unknown],
      ];

      expect(firstCall[0].idempotencyKey).toBe(secondCall[0].idempotencyKey);
    });
  });

  describe('no tenant context', () => {
    it('does not call setTenantContext (tx.execute not called)', async () => {
      await service.processEvent(makeRunStartEvent(), PROJECT_ID, ORG_ID);

      expect(mockTxExecute).not.toHaveBeenCalled();
    });
  });
});
