import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { ErrorFilters } from './components/error-filters';
import { ErrorGroupDetailPanel } from './components/error-group-detail-panel';
import { ErrorGroupsTable } from './components/error-groups-table';
import { ErrorMetricToggle } from './components/error-metric-toggle';
import { ErrorTimelineChart } from './components/error-timeline-chart';
import { useErrorGroups } from './hooks/use-error-groups';
import { useErrorTimeline } from './hooks/use-error-timeline';
import { useUpdateParam } from './hooks/use-update-param';

import { useProject } from '@/contexts/project-context';
import { PageHeader } from '@/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useSortable } from '@/shared/hooks/use-sortable';

export function ErrorExplorerPage() {
  const [searchParams] = useSearchParams();
  const { selectedProjectIds, isAllSelected } = useProject();
  const { sortBy, sortDirection: sortOrder, handleSort } = useSortable({ syncWithUrl: true });

  const days = Number(searchParams.get('days')) || 30;
  const metric = searchParams.get('metric') || 'occurrences';
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

  const initialErrorGroupId = searchParams.get('errorGroupId') || null;
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(initialErrorGroupId);

  const { data: timelineData, loading: timelineLoading } = useErrorTimeline({
    projectId,
    dateFrom,
    dateTo,
    branch: branch || undefined,
    search: search || undefined,
    category: category || undefined,
    metric,
    topN: 5,
  });

  const { data: groupsData, loading: groupsLoading } = useErrorGroups({
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
            <ErrorGroupDetailPanel key={expandedGroupId} errorGroupId={expandedGroupId} />
          </ErrorGroupsTable>
        </>
      )}
    </div>
  );
}
