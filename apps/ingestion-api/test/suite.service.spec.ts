import type { Database } from '@assertly/database';
import type { ProjectId, RunId, SuiteId } from '@assertly/shared-types';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SuiteService } from '../src/modules/ingestion/services/suite.service';

const PROJECT_ID = 'project-1' as ProjectId;
const RUN_ID = '00000000-0000-4000-a000-000000000001' as RunId;
const SUITE_ID = '00000000-0000-4000-a000-000000000010' as SuiteId;
const PARENT_SUITE_ID = '00000000-0000-4000-a000-000000000009' as SuiteId;
const TIMESTAMP = '2026-02-24T10:00:00.000Z';

function makeMockTx(runOwnerProjectId: ProjectId = PROJECT_ID) {
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
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };
}

describe('SuiteService', () => {
  let service: SuiteService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [SuiteService],
    }).compile();

    service = module.get(SuiteService);
  });

  describe('handleSuiteStart', () => {
    it('inserts a suite with runId and name, returns runId', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'suite.start' as const,
        payload: {
          suiteId: SUITE_ID,
          suiteName: 'Auth Suite',
        },
      };

      const result = await service.handleSuiteStart(
        event,
        PROJECT_ID,
        mockTx as unknown as Database,
      );

      expect(result).toEqual({ runId: RUN_ID });
      expect(mockTx.insert).toHaveBeenCalledTimes(1);

      const valuesArg = mockTx.insert().values.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(valuesArg).toMatchObject({
        id: SUITE_ID,
        runId: RUN_ID,
        name: 'Auth Suite',
      });
    });

    it('sets parentSuiteId to null when not provided', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'suite.start' as const,
        payload: {
          suiteId: SUITE_ID,
          suiteName: 'Root Suite',
        },
      };

      await service.handleSuiteStart(event, PROJECT_ID, mockTx as unknown as Database);

      const valuesArg = mockTx.insert().values.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(valuesArg['parentSuiteId']).toBeNull();
    });

    it('stores parentSuiteId when provided', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'suite.start' as const,
        payload: {
          suiteId: SUITE_ID,
          suiteName: 'Nested Suite',
          parentSuiteId: PARENT_SUITE_ID,
        },
      };

      await service.handleSuiteStart(event, PROJECT_ID, mockTx as unknown as Database);

      const valuesArg = mockTx.insert().values.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(valuesArg['parentSuiteId']).toBe(PARENT_SUITE_ID);
    });

    it('throws NotFoundException when run belongs to a different project', async () => {
      const mockTx = makeMockTx('project-other' as ProjectId);

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'suite.start' as const,
        payload: {
          suiteId: SUITE_ID,
          suiteName: 'Auth Suite',
        },
      };

      await expect(
        service.handleSuiteStart(event, PROJECT_ID, mockTx as unknown as Database),
      ).rejects.toThrow(NotFoundException);
    });

    it('does not insert the suite when ownership verification fails', async () => {
      const mockTx = makeMockTx('project-other' as ProjectId);

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'suite.start' as const,
        payload: {
          suiteId: SUITE_ID,
          suiteName: 'Auth Suite',
        },
      };

      await expect(
        service.handleSuiteStart(event, PROJECT_ID, mockTx as unknown as Database),
      ).rejects.toThrow(NotFoundException);

      expect(mockTx.insert).not.toHaveBeenCalled();
    });
  });

  describe('handleSuiteEnd', () => {
    it('returns runId without performing any database write', async () => {
      const mockTx = makeMockTx();

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'suite.end' as const,
        payload: { suiteId: SUITE_ID },
      };

      const result = await service.handleSuiteEnd(event, PROJECT_ID, mockTx as unknown as Database);

      expect(result).toEqual({ runId: RUN_ID });
      // Suite end only verifies ownership; no update is written
      expect(mockTx.update).not.toHaveBeenCalled();
      expect(mockTx.insert).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when run belongs to a different project', async () => {
      const mockTx = makeMockTx('project-other' as ProjectId);

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'suite.end' as const,
        payload: { suiteId: SUITE_ID },
      };

      await expect(
        service.handleSuiteEnd(event, PROJECT_ID, mockTx as unknown as Database),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
