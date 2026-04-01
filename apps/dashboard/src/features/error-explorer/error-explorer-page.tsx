import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { ErrorGroupDetailPanel } from './components/error-group-detail-panel';
import { ErrorGroupsTable } from './components/error-groups-table';
import { ErrorMetricToggle } from './components/error-metric-toggle';
import { ErrorTableFilters } from './components/error-table-filters';
import type { ErrorMetric } from './components/error-timeline-chart';
import { ErrorTimelineChart } from './components/error-timeline-chart';
import { useErrorGroups } from './hooks/use-error-groups';
import { useErrorTimeline } from './hooks/use-error-timeline';

import { useProject } from '@/contexts/project-context';
import { PageHeader } from '@/layout/page-header';
import { ErrorBoundary } from '@/shared/components/error-boundary';
import { PeriodSelector } from '@/shared/components/period-selector';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { usePeriodSelector } from '@/shared/hooks/use-period-selector';
import { useSortable } from '@/shared/hooks/use-sortable';
import { useUpdateParam } from '@/shared/hooks/use-update-param';

export function ErrorExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedProjectIds, isAllSelected } = useProject();
  const { sortBy, sortDirection: sortOrder, handleSort } = useSortable({ syncWithUrl: true });
  const {
    days,
    setDays,
    options: periodOptions,
  } = usePeriodSelector({
    options: [7, 14, 30, 60, 90],
    defaultDays: 30,
    syncWithUrl: true,
  });
  const metricParam = searchParams.get('metric');
  const metric: ErrorMetric =
    metricParam === 'uniqueTests' || metricParam === 'uniqueBranches' ? metricParam : 'occurrences';
  const branch = searchParams.get('branch') || '';
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const page = Number(searchParams.get('page')) || 1;
  const pageSize = Number(searchParams.get('pageSize')) || 20;

  // Memoize to prevent infinite re-render loop; round to minute boundary for stability
  const { dateFrom, dateTo } = useMemo(() => {
    const now = Date.now();
    const roundedNow = now - (now % 60_000);
    return {
      dateFrom: roundedNow - days * 24 * 60 * 60 * 1000,
      dateTo: roundedNow,
    };
  }, [days]);

  // API requires a single project ID
  const projectId =
    !isAllSelected && selectedProjectIds.length === 1 ? selectedProjectIds[0] : null;

  // errorGroupId is kept in the URL while the detail panel is open.
  // Deep links (e.g. from RunErrorsSummary) set it; closing the panel clears it.
  const expandedGroupId = searchParams.get('errorGroupId') || null;
  const setExpandedGroupId = useCallback(
    (id: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) {
            next.set('errorGroupId', id);
          } else {
            next.delete('errorGroupId');
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const {
    data: timelineData,
    loading: timelineLoading,
    error: timelineError,
  } = useErrorTimeline({
    projectId,
    dateFrom,
    dateTo,
    branch: branch || undefined,
    search: search || undefined,
    category: category || undefined,
    metric,
    topN: 5,
  });

  const {
    data: groupsData,
    loading: groupsLoading,
    error: groupsError,
  } = useErrorGroups({
    projectId,
    dateFrom,
    dateTo,
    branch: branch || undefined,
    search: search || undefined,
    category: category || undefined,
    sortBy: sortBy || undefined,
    sortOrder: sortOrder || undefined,
    page,
    pageSize,
  });

  const updateParam = useUpdateParam();

  return (
    <div className="space-y-6">
      <PageHeader title="Error Explorer" description="Track and analyze test errors." />

      {isAllSelected || selectedProjectIds.length !== 1 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Error Explorer requires a single project. Select one project from the dropdown above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <PeriodSelector options={periodOptions} value={days} onChange={setDays} />

          {timelineError || groupsError ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-destructive">
                  Failed to load error data. Please try again.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Error Timeline</CardTitle>
                  <ErrorMetricToggle />
                </CardHeader>
                <CardContent>
                  <ErrorTimelineChart
                    data={timelineData}
                    loading={timelineLoading}
                    metric={metric}
                  />
                </CardContent>
              </Card>

              <ErrorTableFilters />

              <ErrorGroupsTable
                data={groupsData}
                loading={groupsLoading}
                expandedId={expandedGroupId}
                onExpand={setExpandedGroupId}
                sortBy={sortBy}
                sortDirection={sortOrder}
                onSort={handleSort}
                pageSize={pageSize}
                onPageChange={(p) => updateParam('page', String(p))}
                onPageSizeChange={(s) => updateParam('pageSize', String(s))}
                renderDetail={(groupId) => (
                  <ErrorBoundary
                    fallback={
                      <p className="py-4 text-center text-sm text-destructive">
                        Failed to render error details
                      </p>
                    }
                  >
                    <ErrorGroupDetailPanel
                      errorGroupId={groupId}
                      dateFrom={dateFrom}
                      dateTo={dateTo}
                    />
                  </ErrorBoundary>
                )}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
