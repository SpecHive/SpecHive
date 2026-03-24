import { useApi } from '@/shared/hooks/use-api';
import type {
  DurationTrendPoint,
  OrganizationAnalyticsSummary,
  OrganizationFlakyTestSummary,
  PaginatedResponse,
  PassRateTrendPoint,
  RunSummary,
} from '@/types/api';

export interface UseDashboardAnalyticsResult {
  summary: OrganizationAnalyticsSummary | null;
  passRateTrend: PassRateTrendPoint[] | null;
  durationTrend: DurationTrendPoint[] | null;
  flakyTests: OrganizationFlakyTestSummary[] | null;
  recentRuns: RunSummary[];
  isOrgView: boolean;
  loading: boolean;
  summaryLoading: boolean;
  trendLoading: boolean;
  durationLoading: boolean;
  flakyLoading: boolean;
  summaryError: string | null;
}

export function useDashboardAnalytics(
  projectIds: string[],
  isAllSelected: boolean,
  days: number,
  projectsLoading: boolean,
): UseDashboardAnalyticsResult {
  const isOrgView = isAllSelected;
  const projectIdsParam = isAllSelected ? undefined : projectIds.join(',');

  const baseParams: Record<string, string> = { days: String(days) };
  if (projectIdsParam) baseParams.projectIds = projectIdsParam;

  const runsParams: Record<string, string> = { pageSize: '10' };
  if (projectIdsParam) runsParams.projectIds = projectIdsParam;

  const { data: runsData, loading: runsLoading } = useApi<PaginatedResponse<RunSummary>>(
    '/v1/runs',
    runsParams,
  );

  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
  } = useApi<OrganizationAnalyticsSummary>('/v1/analytics/summary', baseParams, {
    toastId: 'api-error:analytics',
  });

  const { data: passRateTrend, loading: trendLoading } = useApi<PassRateTrendPoint[]>(
    '/v1/analytics/pass-rate-trend',
    baseParams,
    { toastId: 'api-error:analytics' },
  );

  const { data: durationTrend, loading: durationLoading } = useApi<DurationTrendPoint[]>(
    '/v1/analytics/duration-trend',
    baseParams,
    { toastId: 'api-error:analytics' },
  );

  const { data: flakyTests, loading: flakyLoading } = useApi<OrganizationFlakyTestSummary[]>(
    '/v1/analytics/flaky-tests',
    { ...baseParams, limit: '10' },
    { toastId: 'api-error:analytics' },
  );

  const loading = projectsLoading || runsLoading || summaryLoading;
  const recentRuns = runsData?.data || [];

  return {
    summary,
    passRateTrend,
    durationTrend,
    flakyTests,
    recentRuns,
    isOrgView,
    loading,
    summaryLoading,
    trendLoading,
    durationLoading,
    flakyLoading,
    summaryError,
  };
}
