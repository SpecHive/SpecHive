import { Test } from '@nestjs/testing';
import { OUTBOXY_CLIENT } from '@outboxy/sdk-nestjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { IngestionService, DATABASE_CONNECTION } from '../src/modules/ingestion/ingestion.service';
import { ArtifactService } from '../src/modules/ingestion/services/artifact.service';
import { RunService } from '../src/modules/ingestion/services/run.service';
import { SuiteService } from '../src/modules/ingestion/services/suite.service';
import { TestService } from '../src/modules/ingestion/services/test.service';

const PROJECT_ID = 'project-1';
const RUN_ID = '00000000-0000-4000-a000-000000000001';

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

  const mockDb = {
    transaction: vi.fn(),
  };

  const mockOutboxy = {
    publish: mockPublish,
  };

  const mockRunService = {
    handleRunStart: vi.fn(),
    handleRunEnd: vi.fn(),
  };

  const mockSuiteService = {
    handleSuiteStart: vi.fn(),
    handleSuiteEnd: vi.fn(),
  };

  const mockTestService = {
    handleTestStart: vi.fn(),
    handleTestEnd: vi.fn(),
  };

  const mockArtifactService = {
    handleArtifactUpload: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockRunService.handleRunStart.mockResolvedValue({ runId: RUN_ID });
    mockRunService.handleRunEnd.mockResolvedValue({ runId: RUN_ID });
    mockSuiteService.handleSuiteStart.mockResolvedValue({ runId: RUN_ID });
    mockSuiteService.handleSuiteEnd.mockResolvedValue({ runId: RUN_ID });
    mockTestService.handleTestStart.mockResolvedValue({ runId: RUN_ID });
    mockTestService.handleTestEnd.mockResolvedValue({ runId: RUN_ID });
    mockArtifactService.handleArtifactUpload.mockResolvedValue({ runId: RUN_ID });

    mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb(Object.assign({}, { $client: {} }));
    });

    mockPublish.mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: DATABASE_CONNECTION, useValue: mockDb },
        { provide: OUTBOXY_CLIENT, useValue: mockOutboxy },
        { provide: RunService, useValue: mockRunService },
        { provide: SuiteService, useValue: mockSuiteService },
        { provide: TestService, useValue: mockTestService },
        { provide: ArtifactService, useValue: mockArtifactService },
      ],
    }).compile();

    service = module.get(IngestionService);
  });

  describe('run.start', () => {
    it('delegates to RunService and publishes outbox event', async () => {
      const event = makeRunStartEvent();
      const result = await service.processEvent(event, PROJECT_ID);

      expect(result).toEqual({ runId: RUN_ID });
      expect(mockRunService.handleRunStart).toHaveBeenCalledWith(
        event,
        PROJECT_ID,
        expect.anything(),
      );
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: 'TestRun',
          aggregateId: RUN_ID,
          eventType: 'run.start',
        }),
        expect.anything(),
      );
    });
  });

  describe('run.end', () => {
    it('delegates to RunService', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: RUN_ID,
        eventType: 'run.end' as const,
        payload: { status: 'passed' as const },
      };

      const result = await service.processEvent(event, PROJECT_ID);
      expect(result).toEqual({ runId: RUN_ID });
      expect(mockRunService.handleRunEnd).toHaveBeenCalledWith(
        event,
        PROJECT_ID,
        expect.anything(),
      );
    });
  });

  describe('suite.start', () => {
    it('delegates to SuiteService', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: RUN_ID,
        eventType: 'suite.start' as const,
        payload: {
          suiteId: '00000000-0000-4000-a000-000000000010',
          suiteName: 'Test Suite',
        },
      };

      const result = await service.processEvent(event, PROJECT_ID);
      expect(result).toEqual({ runId: RUN_ID });
      expect(mockSuiteService.handleSuiteStart).toHaveBeenCalled();
    });
  });

  describe('suite.end', () => {
    it('delegates to SuiteService', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: RUN_ID,
        eventType: 'suite.end' as const,
        payload: {
          suiteId: '00000000-0000-4000-a000-000000000010',
        },
      };

      const result = await service.processEvent(event, PROJECT_ID);
      expect(result).toEqual({ runId: RUN_ID });
      expect(mockSuiteService.handleSuiteEnd).toHaveBeenCalled();
    });
  });

  describe('test.start', () => {
    it('delegates to TestService', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: RUN_ID,
        eventType: 'test.start' as const,
        payload: {
          testId: '00000000-0000-4000-a000-000000000020',
          suiteId: '00000000-0000-4000-a000-000000000010',
          testName: 'should pass',
        },
      };

      const result = await service.processEvent(event, PROJECT_ID);
      expect(result).toEqual({ runId: RUN_ID });
      expect(mockTestService.handleTestStart).toHaveBeenCalled();
    });
  });

  describe('test.end', () => {
    it('delegates to TestService', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: RUN_ID,
        eventType: 'test.end' as const,
        payload: {
          testId: '00000000-0000-4000-a000-000000000020',
          status: 'passed' as const,
          durationMs: 100,
        },
      };

      const result = await service.processEvent(event, PROJECT_ID);
      expect(result).toEqual({ runId: RUN_ID });
      expect(mockTestService.handleTestEnd).toHaveBeenCalled();
    });
  });

  describe('artifact.upload', () => {
    it('delegates to ArtifactService', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: RUN_ID,
        eventType: 'artifact.upload' as const,
        payload: {
          testId: '00000000-0000-4000-a000-000000000020',
          artifactType: 'screenshot' as const,
          name: 'failure.png',
          data: 'base64data',
        },
      };

      const result = await service.processEvent(event, PROJECT_ID);
      expect(result).toEqual({ runId: RUN_ID });
      expect(mockArtifactService.handleArtifactUpload).toHaveBeenCalled();
    });
  });

  describe('transaction rollback', () => {
    it('rejects when outboxy.publish() throws', async () => {
      mockPublish.mockRejectedValue(new Error('Outbox publish failed'));

      await expect(service.processEvent(makeRunStartEvent(), PROJECT_ID)).rejects.toThrow(
        'Outbox publish failed',
      );
    });
  });
});
