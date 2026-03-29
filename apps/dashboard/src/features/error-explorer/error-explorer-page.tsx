import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { ErrorFilters } from './components/error-filters';
import { ErrorGroupDetailPanel } from './components/error-group-detail-panel';
import { ErrorGroupsTable } from './components/error-groups-table';
import { ErrorMetricToggle } from './components/error-metric-toggle';
import { ErrorTimelineChart } from './components/error-timeline-chart';
import { useErrorGroups } from './hooks/use-error-groups';
import { useErrorTimeline } from './hooks/use-error-timeline';

import { useProject } from '@/contexts/project-context';
import { PageHeader } from '@/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useSortable } from '@/shared/hooks/use-sortable';

export function ErrorExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedProjectIds, isAllSelected } = useProject();
  const { sortBy, sortDirection: sortOrder, handleSort } = useSortable({ syncWithUrl: true });

  const days = Number(searchParams.get('days')) || 30;
  const metric = searchParams.get('metric') || 'occurrences';
  const branch = searchParams.get('branch') || '';
  const search = searchParams.get('search') || '';
  const page = Number(searchParams.get('page')) || 1;
  const pageSize = Number(searchParams.get('pageSize')) || 20;

  // Memoize to prevent infinite re-render loop
  const { dateFrom, dateTo } = useMemo(() => {
    const now = Date.now();
    return {
      dateFrom: now - days * 24 * 60 * 60 * 1000,
      dateTo: now,
    };
  }, [days]);

  // API requires a single project ID
  const projectId =
    !isAllSelected && selectedProjectIds.length === 1 ? selectedProjectIds[0] : null;

  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const { data: timelineData, loading: timelineLoading } = useErrorTimeline({
    projectId,
    dateFrom,
    dateTo,
    branch: branch || undefined,
    search: search || undefined,
    metric,
    topN: 5,
  });

  const { data: groupsData, loading: groupsLoading } = useErrorGroups({
    projectId,
    dateFrom,
    dateTo,
    branch: branch || undefined,
    search: search || undefined,
    sortBy: sortBy || undefined,
    sortOrder: sortOrder || undefined,
    page,
    pageSize,
  });

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

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
          <ErrorFilters />
          <ErrorMetricToggle />

          <Card>
            <CardHeader>
              <CardTitle>Error Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ErrorTimelineChart data={timelineData} loading={timelineLoading} metric={metric} />
            </CardContent>
          </Card>

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
          >
            <ErrorGroupDetailPanel errorGroupId={expandedGroupId} />
          </ErrorGroupsTable>
        </>
      )}
    </div>
  );
}
