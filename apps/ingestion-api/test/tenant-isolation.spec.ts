import type { Database } from '@assertly/database';
import type { ProjectId, RunId, SuiteId, TestId } from '@assertly/shared-types';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ArtifactService } from '../src/modules/ingestion/services/artifact.service';
import { RunService } from '../src/modules/ingestion/services/run.service';
import { SuiteService } from '../src/modules/ingestion/services/suite.service';
import { TestService } from '../src/modules/ingestion/services/test.service';

const CORRECT_PROJECT_ID = 'project-correct' as ProjectId;
const WRONG_PROJECT_ID = 'project-wrong' as ProjectId;
const RUN_ID = '00000000-0000-4000-a000-000000000001' as RunId;
const SUITE_ID = '00000000-0000-4000-a000-000000000010' as SuiteId;
const TEST_ID = '00000000-0000-4000-a000-000000000020' as TestId;
const TIMESTAMP = '2026-02-25T10:00:00.000Z';

// mockTx returns a run owned by CORRECT_PROJECT_ID.
// Passing WRONG_PROJECT_ID to any service method triggers verifyRunOwnership to throw.
const mockTx = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ projectId: CORRECT_PROJECT_ID }]),
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

describe('Tenant isolation — verifyRunOwnership cross-tenant rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockTx.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ projectId: CORRECT_PROJECT_ID }]),
        }),
      }),
    });

    mockTx.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    mockTx.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  describe('RunService.handleRunEnd', () => {
    it('throws NotFoundException when run belongs to a different project', async () => {
      const module = await Test.createTestingModule({
        providers: [RunService],
      }).compile();

      const service = module.get(RunService);

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'run.end' as const,
        payload: { status: 'passed' as const },
      };

      await expect(
        service.handleRunEnd(event, WRONG_PROJECT_ID, mockTx as unknown as Database),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('SuiteService.handleSuiteStart', () => {
    it('throws NotFoundException when run belongs to a different project', async () => {
      const module = await Test.createTestingModule({
        providers: [SuiteService],
      }).compile();

      const service = module.get(SuiteService);

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
        service.handleSuiteStart(event, WRONG_PROJECT_ID, mockTx as unknown as Database),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('TestService.handleTestStart', () => {
    it('throws NotFoundException when run belongs to a different project', async () => {
      const module = await Test.createTestingModule({
        providers: [TestService],
      }).compile();

      const service = module.get(TestService);

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
        service.handleTestStart(event, WRONG_PROJECT_ID, mockTx as unknown as Database),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('SuiteService.handleSuiteEnd', () => {
    it('throws NotFoundException when run belongs to a different project', async () => {
      const module = await Test.createTestingModule({
        providers: [SuiteService],
      }).compile();

      const service = module.get(SuiteService);

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'suite.end' as const,
        payload: { suiteId: SUITE_ID },
      };

      await expect(
        service.handleSuiteEnd(event, WRONG_PROJECT_ID, mockTx as unknown as Database),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('TestService.handleTestEnd', () => {
    it('throws NotFoundException when run belongs to a different project', async () => {
      const module = await Test.createTestingModule({
        providers: [TestService],
      }).compile();

      const service = module.get(TestService);

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
        service.handleTestEnd(event, WRONG_PROJECT_ID, mockTx as unknown as Database),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('ArtifactService.handleArtifactUpload', () => {
    it('throws NotFoundException when run belongs to a different project', async () => {
      const module = await Test.createTestingModule({
        providers: [ArtifactService, { provide: ConfigService, useValue: { get: () => 'test' } }],
      }).compile();

      const service = module.get(ArtifactService);

      const event = {
        version: '1' as const,
        timestamp: TIMESTAMP,
        runId: RUN_ID,
        eventType: 'artifact.upload' as const,
        payload: {
          testId: TEST_ID,
          artifactType: 'screenshot' as const,
          name: 'failure.png',
          data: 'base64encodeddata',
        },
      };

      await expect(
        service.handleArtifactUpload(event, WRONG_PROJECT_ID, mockTx as unknown as Database),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
