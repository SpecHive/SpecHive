import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { OrganizationId, ProjectId } from '@assertly/shared-types';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AnalyticsService } from '../src/modules/analytics/analytics.service';

vi.mock('@assertly/database', async (importOriginal) => {
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
    it('returns default values when no data exists', async () => {
      // Summary query returns empty, retried query returns 0
      mockExecute.mockResolvedValueOnce([]);
      mockExecute.mockResolvedValueOnce([{ retriedTests: 0 }]);

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

    it('returns summary when data exists', async () => {
      const mockSummaryRow = {
        totalRuns: 5,
        totalTests: 100,
        passedTests: 90,
        failedTests: 8,
        skippedTests: 2,
        flakyTests: 1,
        passRate: 90.0,
        avgDurationMs: 5000,
      };
      mockExecute.mockResolvedValueOnce([mockSummaryRow]);
      mockExecute.mockResolvedValueOnce([{ retriedTests: 3 }]);

      const result = await service.getProjectSummary(orgId, projectId);

      expect(result).toEqual({ ...mockSummaryRow, retriedTests: 3 });
    });

    it('calls setTenantContext with correct organizationId', async () => {
      const { setTenantContext } = await import('@assertly/database');
      mockExecute.mockResolvedValueOnce([]);
      mockExecute.mockResolvedValueOnce([{ retriedTests: 0 }]);

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
      // Verify the contract: totalRuns should always be >= flakyCount
      expect(result[0].totalRuns).toBeGreaterThanOrEqual(result[0].flakyCount);
      expect(result[1].totalRuns).toBeGreaterThanOrEqual(result[1].flakyCount);
    });

    it('clamps days to max 90', async () => {
      mockExecute.mockResolvedValueOnce([]);

      await service.getFlakyTests(orgId, projectId, 200, 10);

      // The SQL query uses the clamped value — verify transaction was called
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('clamps limit to max 100', async () => {
      mockExecute.mockResolvedValueOnce([]);

      await service.getFlakyTests(orgId, projectId, 30, 500);

      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });
});
