import { Test } from '@nestjs/testing';
import { DATABASE_CONNECTION } from '@spechive/nestjs-common';
import type { OrganizationId, ProjectId } from '@spechive/shared-types';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AnalyticsService } from '../src/modules/analytics/analytics.service';

vi.mock('@spechive/database', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    setTenantContext: vi.fn(),
  };
});

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  const mockExecute = vi.fn();

  const mockTx = { execute: mockExecute };

  const mockDb = {
    transaction: vi.fn((callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)),
  };

  const orgId = 'org-1' as OrganizationId;
  const projectId = 'proj-1' as ProjectId;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    service = module.get(AnalyticsService);
  });

  describe('getProjectSummary', () => {
    it('returns zero values when no data exists', async () => {
      // SQL aggregate without GROUP BY always returns 1 row; COALESCE turns NULLs into 0
      mockExecute.mockResolvedValueOnce([
        {
          totalRuns: 0,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          skippedTests: 0,
          flakyTests: 0,
          passRate: 0,
          avgDurationMs: 0,
          retriedTests: 0,
        },
      ]);

      const result = await service.getProjectSummary(orgId, projectId);

      expect(result).toEqual({
        totalRuns: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        flakyTests: 0,
        passRate: 0,
        avgDurationMs: 0,
        retriedTests: 0,
      });
    });

    it('returns summary from pre-aggregated data', async () => {
      const mockRow = {
        totalRuns: 5,
        totalTests: 100,
        passedTests: 90,
        failedTests: 8,
        skippedTests: 2,
        flakyTests: 1,
        passRate: 90.0,
        avgDurationMs: 5000,
        retriedTests: 3,
      };
      mockExecute.mockResolvedValueOnce([mockRow]);

      const result = await service.getProjectSummary(orgId, projectId);

      expect(result).toEqual(mockRow);
    });

    it('uses a single query instead of Promise.all', async () => {
      mockExecute.mockResolvedValueOnce([
        {
          totalRuns: 1,
          totalTests: 10,
          passedTests: 10,
          failedTests: 0,
          skippedTests: 0,
          flakyTests: 0,
          passRate: 100,
          avgDurationMs: 1000,
          retriedTests: 0,
        },
      ]);

      await service.getProjectSummary(orgId, projectId);

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('calls setTenantContext with correct organizationId', async () => {
      const { setTenantContext } = await import('@spechive/database');
      mockExecute.mockResolvedValueOnce([
        {
          totalRuns: 0,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          skippedTests: 0,
          flakyTests: 0,
          passRate: 0,
          avgDurationMs: 0,
          retriedTests: 0,
        },
      ]);

      await service.getProjectSummary(orgId, projectId);

      expect(setTenantContext).toHaveBeenCalledWith(mockTx, orgId);
    });
  });

  describe('getPassRateTrend', () => {
    it('returns typed array of PassRateTrendPoint', async () => {
      const mockData = [
        { date: '2026-01-01', passRate: 95.5, totalTests: 100, passedTests: 95, failedTests: 5 },
        { date: '2026-01-02', passRate: 90.0, totalTests: 80, passedTests: 72, failedTests: 8 },
      ];
      mockExecute.mockResolvedValueOnce(mockData);

      const result = await service.getPassRateTrend(orgId, projectId, 30);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('passRate');
      expect(result[0]).toHaveProperty('totalTests');
    });
  });

  describe('getDurationTrend', () => {
    it('returns typed array of DurationTrendPoint', async () => {
      const mockData = [
        { date: '2026-01-01', avgDurationMs: 5000, minDurationMs: 1000, maxDurationMs: 10000 },
      ];
      mockExecute.mockResolvedValueOnce(mockData);

      const result = await service.getDurationTrend(orgId, projectId, 30);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('avgDurationMs');
      expect(result[0]).toHaveProperty('minDurationMs');
      expect(result[0]).toHaveProperty('maxDurationMs');
    });

    it('returns null for min/max when no run in the bucket had a known duration', async () => {
      const mockData = [
        { date: '2026-01-01', avgDurationMs: 0, minDurationMs: null, maxDurationMs: null },
      ];
      mockExecute.mockResolvedValueOnce(mockData);

      const result = await service.getDurationTrend(orgId, projectId, 30);

      expect(result[0]!.minDurationMs).toBeNull();
      expect(result[0]!.maxDurationMs).toBeNull();
    });
  });

  describe('getFlakyTests', () => {
    it('returns typed array of FlakyTestSummary', async () => {
      const mockData = [
        { testName: 'should login', flakyCount: 5, totalRuns: 10, avgRetries: 2.5 },
        { testName: 'should logout', flakyCount: 2, totalRuns: 10, avgRetries: 1.0 },
      ];
      mockExecute.mockResolvedValueOnce(mockData);

      const result = await service.getFlakyTests(orgId, projectId, 30, 10);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('testName');
      expect(result[0]).toHaveProperty('flakyCount');
      expect(result[0]).toHaveProperty('totalRuns');
      expect(result[0].totalRuns).toBeGreaterThanOrEqual(result[0].flakyCount);
      expect(result[1].totalRuns).toBeGreaterThanOrEqual(result[1].flakyCount);
    });

    it('clamps days to max 90', async () => {
      mockExecute.mockResolvedValueOnce([]);

      await service.getFlakyTests(orgId, projectId, 200, 10);

      // Verify the clamped lookbackDays (90 - 1 = 89) reaches the SQL, not the raw 199.
      // Drizzle stores raw template expressions in queryChunks — numeric params are plain numbers.
      const sqlArg = mockExecute.mock.calls[0]![0] as { queryChunks: unknown[] };
      const numericParams = sqlArg.queryChunks.filter((c): c is number => typeof c === 'number');
      expect(numericParams).toContain(89);
      expect(numericParams).not.toContain(199);
    });

    it('clamps limit to max 100', async () => {
      mockExecute.mockResolvedValueOnce([]);

      await service.getFlakyTests(orgId, projectId, 30, 500);

      // Verify the clamped limit (100) reaches the SQL, not the raw 500.
      // Drizzle stores raw template expressions in queryChunks — numeric params are plain numbers.
      const sqlArg = mockExecute.mock.calls[0]![0] as { queryChunks: unknown[] };
      const numericParams = sqlArg.queryChunks.filter((c): c is number => typeof c === 'number');
      expect(numericParams).toContain(100);
      expect(numericParams).not.toContain(500);
    });
  });
});
