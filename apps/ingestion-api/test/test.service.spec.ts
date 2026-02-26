import type { Database } from '@assertly/database';
import type { OrganizationId, ProjectId, RunId, SuiteId, TestId } from '@assertly/shared-types';
import { TestStatus } from '@assertly/shared-types';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SQL } from 'drizzle-orm';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { TestService } from '../src/modules/ingestion/services/test.service';

const PROJECT_ID = 'project-1' as ProjectId;
const ORG_ID = '00000000-0000-4000-a000-000000000099' as OrganizationId;
const RUN_ID = '00000000-0000-4000-a000-000000000001' as RunId;
const SUITE_ID = '00000000-0000-4000-a000-000000000010' as SuiteId;
const TEST_ID = '00000000-0000-4000-a000-000000000020' as TestId;
const TIMESTAMP = '2026-02-24T10:00:00.000Z';

function makeMockTx(runOwnerProjectId: ProjectId = PROJECT_ID) {
  const whereUpdateFn = vi.fn().mockResolvedValue(undefined);
  const setFn = vi.fn().mockReturnValue({ where: whereUpdateFn });
  const updateFn = vi.fn().mockReturnValue({ set: setFn });

  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ projectId: runOwnerProjectId }]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: updateFn,
    _set: setFn,
    _whereUpdate: whereUpdateFn,
  };
}

describe('TestService', () => {
  let service: TestService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TestService],
    }).compile();

    service = module.get(TestService);
  });

  describe('handleTestStart', () => {
    it('inserts a test with all required fields and returns runId', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'test.start' as const,
        payload: {
          testId: TEST_ID,
          suiteId: SUITE_ID,
          testName: 'should authenticate user',
        },
      };

      const result = await service.handleTestStart(
        event,
        PROJECT_ID,
        ORG_ID,
        mockTx as unknown as Database,
      );

      expect(result).toEqual({ runId: RUN_ID });
      expect(mockTx.insert).toHaveBeenCalledTimes(1);

      const valuesArg = mockTx.insert().values.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(valuesArg).toMatchObject({
        id: TEST_ID,
        suiteId: SUITE_ID,
        runId: RUN_ID,
        name: 'should authenticate user',
        status: TestStatus.Pending,
      });
      expect(valuesArg['startedAt']).toBeInstanceOf(Date);
    });

    it('converts the ISO timestamp to a Date for startedAt', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'test.start' as const,
        payload: {
          testId: TEST_ID,
          suiteId: SUITE_ID,
          testName: 'timing test',
        },
      };

      await service.handleTestStart(event, PROJECT_ID, ORG_ID, mockTx as unknown as Database);

      const valuesArg = mockTx.insert().values.mock.calls[0]?.[0] as Record<string, unknown>;
      expect((valuesArg['startedAt'] as Date).toISOString()).toBe(TIMESTAMP);
    });

    it('throws NotFoundException when run belongs to a different project', async () => {
      const mockTx = makeMockTx('project-other' as ProjectId);

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'test.start' as const,
        payload: {
          testId: TEST_ID,
          suiteId: SUITE_ID,
          testName: 'should authenticate user',
        },
      };

      await expect(
        service.handleTestStart(event, PROJECT_ID, ORG_ID, mockTx as unknown as Database),
      ).rejects.toThrow(NotFoundException);

      expect(mockTx.insert).not.toHaveBeenCalled();
    });
  });

  describe('handleTestEnd', () => {
    it('updates the test with status and durationMs, returns runId', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'test.end' as const,
        payload: {
          testId: TEST_ID,
          status: 'passed' as const,
          durationMs: 250,
        },
      };

      const result = await service.handleTestEnd(event, PROJECT_ID, mockTx as unknown as Database);

      expect(result).toEqual({ runId: RUN_ID });
      expect(mockTx.update).toHaveBeenCalledTimes(1);

      const setArg = mockTx._set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setArg).toMatchObject({
        status: 'passed',
        durationMs: 250,
      });
      expect(setArg['finishedAt']).toBeInstanceOf(Date);
    });

    it('sets optional fields to null when missing from payload', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'test.end' as const,
        payload: {
          testId: TEST_ID,
          status: 'passed' as const,
          durationMs: 100,
        },
      };

      await service.handleTestEnd(event, PROJECT_ID, mockTx as unknown as Database);

      const setArg = mockTx._set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setArg['errorMessage']).toBeNull();
      expect(setArg['stackTrace']).toBeNull();
    });

    it('defaults retryCount to 0 when not provided', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'test.end' as const,
        payload: {
          testId: TEST_ID,
          status: 'passed' as const,
          durationMs: 100,
        },
      };

      await service.handleTestEnd(event, PROJECT_ID, mockTx as unknown as Database);

      const setArg = mockTx._set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setArg['retryCount']).toBe(0);
    });

    it('stores errorMessage and stackTrace when present', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'test.end' as const,
        payload: {
          testId: TEST_ID,
          status: 'failed' as const,
          durationMs: 500,
          errorMessage: 'Expected true to be false',
          stackTrace: 'at test.spec.ts:42',
          retryCount: 2,
        },
      };

      await service.handleTestEnd(event, PROJECT_ID, mockTx as unknown as Database);

      const setArg = mockTx._set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setArg['errorMessage']).toBe('Expected true to be false');
      expect(setArg['stackTrace']).toBe('at test.spec.ts:42');
      expect(setArg['retryCount']).toBe(2);
    });

    it('applies WHERE clause scoped to both tests.id and tests.runId', async () => {
      // The source calls: .where(and(eq(tests.id, testId), eq(tests.runId, runId)))
      // We verify that the WHERE is called exactly once and receives an SQL instance
      // produced by the drizzle and() helper (a composite condition, not a plain value).
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'test.end' as const,
        payload: {
          testId: TEST_ID,
          status: 'passed' as const,
          durationMs: 100,
        },
      };

      await service.handleTestEnd(event, PROJECT_ID, mockTx as unknown as Database);

      expect(mockTx._whereUpdate).toHaveBeenCalledTimes(1);

      // The WHERE argument must be an SQL instance (the result of and(eq(...), eq(...)))
      // rather than a primitive — confirming a compound condition was applied.
      const whereArg = mockTx._whereUpdate.mock.calls[0]?.[0] as SQL;
      expect(whereArg).toBeInstanceOf(SQL);

      // Walk the queryChunks tree collecting only primitive (non-object) values so we
      // can verify both bound parameter values appear without hitting Drizzle's circular
      // column references.
      function collectLeafValues(node: unknown): string[] {
        if (node === null || node === undefined) return [];
        if (typeof node === 'string' || typeof node === 'number') return [String(node)];
        if (Array.isArray(node)) return node.flatMap(collectLeafValues);
        if (typeof node === 'object') {
          // Avoid traversing Drizzle column objects that have circular table refs
          const ctor = (node as { constructor?: { name?: string } }).constructor?.name ?? '';
          if (ctor.startsWith('Pg') || ctor === 'Column') return [];
          const record = node as Record<string, unknown>;
          return Object.keys(record).flatMap((k) => collectLeafValues(record[k]));
        }
        return [];
      }

      const leaves = collectLeafValues(whereArg.queryChunks);
      expect(leaves).toContain(TEST_ID);
      expect(leaves).toContain(RUN_ID);
    });

    it('throws NotFoundException when run belongs to a different project', async () => {
      const mockTx = makeMockTx('project-other' as ProjectId);

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'test.end' as const,
        payload: {
          testId: TEST_ID,
          status: 'passed' as const,
          durationMs: 100,
        },
      };

      await expect(
        service.handleTestEnd(event, PROJECT_ID, mockTx as unknown as Database),
      ).rejects.toThrow(NotFoundException);

      expect(mockTx.update).not.toHaveBeenCalled();
    });
  });
});
