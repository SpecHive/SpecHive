import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OUTBOXY_CLIENT } from '@outboxy/sdk-nestjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { IngestionService, DATABASE_CONNECTION } from '../src/modules/ingestion/ingestion.service';

function makeRunStartEvent(overrides: Record<string, unknown> = {}) {
  return {
    version: '1' as const,
    timestamp: '2026-02-24T10:00:00.000Z',
    runId: '00000000-0000-4000-a000-000000000001',
    eventType: 'run.start' as const,
    payload: { projectToken: 'test-token-123' },
    ...overrides,
  };
}

describe('IngestionService', () => {
  let service: IngestionService;

  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockWhere = vi.fn();
  const mockLimit = vi.fn();
  const mockInsert = vi.fn();
  const mockValues = vi.fn();
  const mockUpdate = vi.fn();
  const mockSet = vi.fn();
  const mockUpdateWhere = vi.fn();
  const mockPublish = vi.fn();

  const mockTx = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  };

  const mockDb = {
    transaction: vi.fn(),
  };

  const mockOutboxy = {
    publish: mockPublish,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Chain: tx.select().from().where().limit()
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });

    // Chain: tx.insert().values()
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockResolvedValue(undefined);

    // Chain: tx.update().set().where()
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);

    // Default: transaction executes callback with mockTx
    mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb(Object.assign(mockTx, { $client: {} }));
    });

    mockPublish.mockResolvedValue(undefined);

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
    it('inserts a run and publishes an outbox event for a valid token', async () => {
      mockLimit.mockResolvedValue([{ projectId: 'project-1' }]);

      const event = makeRunStartEvent();
      const result = await service.processEvent(event);

      expect(result).toEqual({ runId: event.runId });
      expect(mockInsert).toHaveBeenCalled();
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: 'TestRun',
          aggregateId: event.runId,
          eventType: 'run.start',
        }),
        expect.anything(),
      );
    });

    it('throws UnauthorizedException for an invalid token', async () => {
      mockLimit.mockResolvedValue([]);

      await expect(service.processEvent(makeRunStartEvent())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for a revoked token (filtered by query)', async () => {
      // Revoked tokens are filtered out at the DB level via isNull(revokedAt)
      mockLimit.mockResolvedValue([]);

      await expect(
        service.processEvent(makeRunStartEvent({ payload: { projectToken: 'revoked-token' } })),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('run.end', () => {
    it('updates the run status', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: '00000000-0000-4000-a000-000000000001',
        eventType: 'run.end' as const,
        payload: { status: 'passed' as const },
      };

      const result = await service.processEvent(event);
      expect(result).toEqual({ runId: event.runId });
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalled();
    });
  });

  describe('suite.start', () => {
    it('inserts a suite record', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: '00000000-0000-4000-a000-000000000001',
        eventType: 'suite.start' as const,
        payload: {
          suiteId: '00000000-0000-4000-a000-000000000010',
          suiteName: 'Test Suite',
        },
      };

      const result = await service.processEvent(event);
      expect(result).toEqual({ runId: event.runId });
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('suite.end', () => {
    it('returns runId without error (no-op)', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: '00000000-0000-4000-a000-000000000001',
        eventType: 'suite.end' as const,
        payload: {
          suiteId: '00000000-0000-4000-a000-000000000010',
        },
      };

      const result = await service.processEvent(event);
      expect(result).toEqual({ runId: event.runId });
    });
  });

  describe('test.start', () => {
    it('inserts a test record', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: '00000000-0000-4000-a000-000000000001',
        eventType: 'test.start' as const,
        payload: {
          testId: '00000000-0000-4000-a000-000000000020',
          suiteId: '00000000-0000-4000-a000-000000000010',
          testName: 'should pass',
        },
      };

      const result = await service.processEvent(event);
      expect(result).toEqual({ runId: event.runId });
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('test.end', () => {
    it('updates the test status', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: '00000000-0000-4000-a000-000000000001',
        eventType: 'test.end' as const,
        payload: {
          testId: '00000000-0000-4000-a000-000000000020',
          status: 'passed' as const,
          durationMs: 100,
        },
      };

      const result = await service.processEvent(event);
      expect(result).toEqual({ runId: event.runId });
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('artifact.upload', () => {
    it('inserts an artifact record', async () => {
      const event = {
        version: '1' as const,
        timestamp: '2026-02-24T10:01:00.000Z',
        runId: '00000000-0000-4000-a000-000000000001',
        eventType: 'artifact.upload' as const,
        payload: {
          testId: '00000000-0000-4000-a000-000000000020',
          artifactType: 'screenshot' as const,
          name: 'failure.png',
          data: 'base64data',
        },
      };

      const result = await service.processEvent(event);
      expect(result).toEqual({ runId: event.runId });
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('transaction rollback', () => {
    it('rejects when outboxy.publish() throws', async () => {
      mockLimit.mockResolvedValue([{ projectId: 'project-1' }]);
      mockPublish.mockRejectedValue(new Error('Outbox publish failed'));

      await expect(service.processEvent(makeRunStartEvent())).rejects.toThrow(
        'Outbox publish failed',
      );
    });
  });
});
