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

  describe('getOrganizationSummary', () => {
    const zeroSummary = {
      totalRuns: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      flakyTests: 0,
      passRate: 0,
      avgDurationMs: 0,
      retriedTests: 0,
      projectCount: 0,
    };

    const zeroPrev = { totalTests: 0, passedTests: 0, flakyTests: 0 };

    it('returns zero values when no data exists', async () => {
      mockExecute.mockResolvedValueOnce([zeroSummary]);
      mockExecute.mockResolvedValueOnce([zeroPrev]);

      const result = await service.getOrganizationSummary(orgId);

      expect(result).toEqual({
        ...zeroSummary,
        passRateDelta: null,
        flakyRate: 0,
        flakyRateDelta: null,
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
        projectCount: 2,
      };
      mockExecute.mockResolvedValueOnce([mockRow]);
      mockExecute.mockResolvedValueOnce([zeroPrev]);

      const result = await service.getOrganizationSummary(orgId);

      expect(result).toMatchObject(mockRow);
      expect(result).toHaveProperty('passRateDelta');
      expect(result).toHaveProperty('flakyRate');
      expect(result).toHaveProperty('flakyRateDelta');
    });

    it('accepts optional projectIds filter', async () => {
      mockExecute.mockResolvedValueOnce([zeroSummary]);
      mockExecute.mockResolvedValueOnce([zeroPrev]);

      await service.getOrganizationSummary(orgId, 30, [projectId]);

      expect(mockExecute).toHaveBeenCalledTimes(2);
      const sqlArg = mockExecute.mock.calls[0][0];
      const flattenChunks = (chunks: unknown[]): unknown[] =>
        chunks.flatMap((c) => {
          if (typeof c === 'string') return [c];
          if (c && typeof c === 'object' && 'queryChunks' in c)
            return flattenChunks((c as { queryChunks: unknown[] }).queryChunks);
          if (c && typeof c === 'object' && 'value' in c) return (c as { value: unknown[] }).value;
          return [c];
        });
      expect(flattenChunks(sqlArg.queryChunks)).toContain(projectId);
    });

    it('calls setTenantContext with correct organizationId', async () => {
      const { setTenantContext } = await import('@spechive/database');
      mockExecute.mockResolvedValueOnce([zeroSummary]);
      mockExecute.mockResolvedValueOnce([zeroPrev]);

      await service.getOrganizationSummary(orgId);

      expect(setTenantContext).toHaveBeenCalledWith(mockTx, orgId);
    });
  });

  describe('getOrganizationPassRateTrend', () => {
    it('returns typed array of PassRateTrendPoint', async () => {
      const mockData = [
        { date: '2026-01-01', passRate: 95.5, totalTests: 100, passedTests: 95, failedTests: 5 },
        { date: '2026-01-02', passRate: 90.0, totalTests: 80, passedTests: 72, failedTests: 8 },
      ];
      mockExecute.mockResolvedValueOnce(mockData);

      const result = await service.getOrganizationPassRateTrend(orgId, 30);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('passRate');
      expect(result[0]).toHaveProperty('totalTests');
    });
  });

  describe('getOrganizationDurationTrend', () => {
    it('returns typed array of DurationTrendPoint', async () => {
      const mockData = [
        { date: '2026-01-01', avgDurationMs: 5000, minDurationMs: 1000, maxDurationMs: 10000 },
      ];
      mockExecute.mockResolvedValueOnce(mockData);

      const result = await service.getOrganizationDurationTrend(orgId, 30);

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

      const result = await service.getOrganizationDurationTrend(orgId, 30);

      expect(result[0]!.minDurationMs).toBeNull();
      expect(result[0]!.maxDurationMs).toBeNull();
    });
  });

  describe('getOrganizationFlakyTests', () => {
    it('returns typed array of OrganizationFlakyTestSummary', async () => {
      const mockData = [
        {
          testName: 'should login',
          flakyCount: 5,
          totalRuns: 10,
          avgRetries: 2.5,
          projectId: 'p1',
          projectName: 'Proj 1',
          flakyCountDelta: 2,
        },
        {
          testName: 'should logout',
          flakyCount: 2,
          totalRuns: 10,
          avgRetries: 1.0,
          projectId: 'p1',
          projectName: 'Proj 1',
          flakyCountDelta: null,
        },
      ];
      mockExecute.mockResolvedValueOnce(mockData);

      const result = await service.getOrganizationFlakyTests(orgId, 30, 10);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('testName');
      expect(result[0]).toHaveProperty('flakyCount');
      expect(result[0]).toHaveProperty('totalRuns');
      expect(result[0]).toHaveProperty('projectId');
      expect(result[0]).toHaveProperty('projectName');
      expect(result[0].totalRuns).toBeGreaterThanOrEqual(result[0].flakyCount);
    });

    it('clamps days to max 90', async () => {
      mockExecute.mockResolvedValueOnce([]);

      await service.getOrganizationFlakyTests(orgId, 200, 10);

      const sqlArg = mockExecute.mock.calls[0]![0] as { queryChunks: unknown[] };
      const numericParams = sqlArg.queryChunks.filter((c): c is number => typeof c === 'number');
      expect(numericParams).toContain(89);
      expect(numericParams).not.toContain(199);
    });

    it('clamps limit to max 100', async () => {
      mockExecute.mockResolvedValueOnce([]);

      await service.getOrganizationFlakyTests(orgId, 30, 500);

      const sqlArg = mockExecute.mock.calls[0]![0] as { queryChunks: unknown[] };
      const numericParams = sqlArg.queryChunks.filter((c): c is number => typeof c === 'number');
      expect(numericParams).toContain(100);
      expect(numericParams).not.toContain(500);
    });
  });

  describe('getProjectComparison', () => {
    function mockEmptyComparison() {
      mockExecute.mockResolvedValueOnce([]);
      mockExecute.mockResolvedValueOnce([]);
      mockExecute.mockResolvedValueOnce([]);
      mockExecute.mockResolvedValueOnce([]);
    }

    function makeProjectRow(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        projectId: 'proj-1',
        projectName: 'Project A',
        totalRuns: 10,
        totalTests: 100,
        passedTests: 90,
        failedTests: 8,
        skippedTests: 2,
        flakyTests: 0,
        retriedTests: 0,
        passRate: 90.0,
        avgDurationMs: 1000,
        minDurationMs: 800,
        maxDurationMs: 1200,
        ...overrides,
      };
    }

    it('returns empty projects and zero org averages when no data exists', async () => {
      mockEmptyComparison();

      const result = await service.getProjectComparison(orgId);

      expect(result.projects).toEqual([]);
      expect(result.orgAverage.passRate).toBe(0);
      expect(result.orgAverage.totalRuns).toBe(0);
      expect(result.orgAverage.healthScore).toBeGreaterThanOrEqual(0);
      expect(result.orgAverage.healthScore).toBeLessThanOrEqual(100);
    });

    it('returns null deltas when no previous period data exists', async () => {
      mockExecute.mockResolvedValueOnce([makeProjectRow()]);
      mockExecute.mockResolvedValueOnce([]);
      mockExecute.mockResolvedValueOnce([]);
      mockExecute.mockResolvedValueOnce([]);

      const result = await service.getProjectComparison(orgId);

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0]!.passRateDelta).toBeNull();
      expect(result.projects[0]!.flakyRateDelta).toBeNull();
      expect(result.projects[0]!.avgDurationDelta).toBeNull();
    });

    it('computes correct deltas when previous period data exists', async () => {
      mockExecute.mockResolvedValueOnce([makeProjectRow()]);
      mockExecute.mockResolvedValueOnce([
        {
          projectId: 'proj-1',
          totalTests: 100,
          passedTests: 80,
          flakyTests: 5,
          passRate: 80.0,
          flakyRate: 5.0,
          avgDurationMs: 1200,
        },
      ]);
      mockExecute.mockResolvedValueOnce([]);
      mockExecute.mockResolvedValueOnce([]);

      const result = await service.getProjectComparison(orgId);
      const proj = result.projects[0]!;

      // passRate 90 - 80 = 10
      expect(proj.passRateDelta).toBe(10);
      // flakyRate 0 - 5 = -5
      expect(proj.flakyRateDelta).toBe(-5);
      // avgDuration 1000 - 1200 = -200
      expect(proj.avgDurationDelta).toBe(-200);
    });

    it('associates sparkline data with correct projects', async () => {
      mockExecute.mockResolvedValueOnce([
        makeProjectRow({
          projectId: 'proj-1',
          projectName: 'A',
          totalRuns: 5,
          totalTests: 50,
          passedTests: 45,
        }),
        makeProjectRow({
          projectId: 'proj-2',
          projectName: 'B',
          totalRuns: 3,
          totalTests: 30,
          passedTests: 27,
          avgDurationMs: 700,
        }),
      ]);
      mockExecute.mockResolvedValueOnce([]);
      mockExecute.mockResolvedValueOnce([
        { projectId: 'proj-1', date: '2026-03-17', passRate: 85.0 },
        { projectId: 'proj-1', date: '2026-03-18', passRate: 90.0 },
        { projectId: 'proj-2', date: '2026-03-17', passRate: 88.0 },
      ]);
      mockExecute.mockResolvedValueOnce([
        { date: '2026-03-17', passRate: 86.0 },
        { date: '2026-03-18', passRate: 90.0 },
      ]);

      const result = await service.getProjectComparison(orgId);

      expect(result.projects[0]!.dailyPassRates).toHaveLength(2);
      expect(result.projects[1]!.dailyPassRates).toHaveLength(1);
      expect(result.orgAverage.dailyPassRates).toHaveLength(2);
    });

    it('computes weighted org averages across multiple projects', async () => {
      mockExecute.mockResolvedValueOnce([
        makeProjectRow({
          projectId: 'proj-1',
          projectName: 'A',
          totalRuns: 10,
          totalTests: 100,
          passedTests: 90,
          failedTests: 5,
          skippedTests: 3,
          flakyTests: 2,
          retriedTests: 1,
          passRate: 90.0,
          avgDurationMs: 1000,
        }),
        makeProjectRow({
          projectId: 'proj-2',
          projectName: 'B',
          totalRuns: 10,
          totalTests: 100,
          passedTests: 80,
          failedTests: 10,
          skippedTests: 5,
          flakyTests: 5,
          retriedTests: 2,
          passRate: 80.0,
          avgDurationMs: 2000,
        }),
      ]);
      mockExecute.mockResolvedValueOnce([]);
      mockExecute.mockResolvedValueOnce([]);
      mockExecute.mockResolvedValueOnce([]);

      const result = await service.getProjectComparison(orgId);

      // passRate: (90+80) / 200 * 100 = 85
      expect(result.orgAverage.passRate).toBe(85);
      // avgDurationMs: weighted by runs — (1000*10 + 2000*10) / 20 = 1500
      expect(result.orgAverage.avgDurationMs).toBe(1500);
      expect(result.orgAverage.totalRuns).toBe(20);
      expect(result.orgAverage.retriedTests).toBe(3);
      expect(result.orgAverage.healthScore).toBeGreaterThanOrEqual(0);
      expect(result.orgAverage.healthScore).toBeLessThanOrEqual(100);
    });

    it('passes projectIds filter to queries', async () => {
      mockEmptyComparison();

      await service.getProjectComparison(orgId, 30, [projectId]);

      expect(mockExecute).toHaveBeenCalledTimes(4);
      const flattenChunks = (chunks: unknown[]): unknown[] =>
        chunks.flatMap((c) => {
          if (typeof c === 'string') return [c];
          if (c && typeof c === 'object' && 'queryChunks' in c)
            return flattenChunks((c as { queryChunks: unknown[] }).queryChunks);
          if (c && typeof c === 'object' && 'value' in c) return (c as { value: unknown[] }).value;
          return [c];
        });
      const firstQueryChunks = flattenChunks(
        (mockExecute.mock.calls[0]![0] as { queryChunks: unknown[] }).queryChunks,
      );
      expect(firstQueryChunks).toContain(projectId);
    });
  });
});
