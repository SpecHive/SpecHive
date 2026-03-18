import { useMemo } from 'react';

import { useProject } from '@/contexts/project-context';
import { PageHeader } from '@/layout/page-header';
import { HorizontalBarChart } from '@/shared/components/charts';
import { PeriodSelector } from '@/shared/components/period-selector';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { SortableHeader } from '@/shared/components/ui/sortable-header';
import { useApi } from '@/shared/hooks/use-api';
import { usePeriodSelector } from '@/shared/hooks/use-period-selector';
import { useSortable } from '@/shared/hooks/use-sortable';
import { CHART_COLORS } from '@/shared/lib/chart-colors';
import { formatDurationMs } from '@/shared/lib/formatters';
import type { ProjectComparisonItem } from '@/types/api';

function passRateColor(rate: number): string {
  if (rate >= 95) return 'text-green-600';
  if (rate >= 80) return 'text-yellow-600';
  return 'text-red-600';
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-64 animate-pulse rounded-lg border bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg border bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function ProjectComparisonPage() {
  const { selectedProjectIds, isAllSelected } = useProject();
  const { days, setDays, options } = usePeriodSelector({
    options: [7, 14, 30, 60, 90],
    defaultDays: 30,
    syncWithUrl: true,
  });

  const { sortBy, sortDirection, handleSort } = useSortable({
    defaultColumn: 'totalRuns',
    defaultDirection: 'desc',
  });

  const comparisonParams: Record<string, string> = { days: String(days) };
  if (!isAllSelected) comparisonParams.projectIds = selectedProjectIds.join(',');

  const { data, loading } = useApi<ProjectComparisonItem[]>(
    '/v1/analytics/project-comparison',
    comparisonParams,
  );

  const sortedData = useMemo(() => {
    if (!data) return [];
    if (!sortBy || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortBy as keyof ProjectComparisonItem];
      const bVal = b[sortBy as keyof ProjectComparisonItem];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [data, sortBy, sortDirection]);

  if (loading && !data) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Project Comparison"
        description="Compare test health across all projects in your organization."
      />

      <PeriodSelector options={options} value={days} onChange={setDays} />

      {!sortedData.length ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              No test data found. Run tests across multiple projects to see comparisons.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pass rate bar chart */}
          {sortedData.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Pass Rate by Project</CardTitle>
              </CardHeader>
              <CardContent>
                <HorizontalBarChart
                  data={sortedData.map((p) => ({
                    projectName: p.projectName,
                    passRate: p.passRate,
                  }))}
                  dataKey="passRate"
                  nameKey="projectName"
                  formatter={(v) => `${v.toFixed(1)}%`}
                  color={CHART_COLORS.pass}
                  ariaLabel="Pass rate comparison across projects"
                />
              </CardContent>
            </Card>
          )}

          {/* Comparison table */}
          <Card>
            <CardHeader>
              <CardTitle>Project Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <SortableHeader
                        label="Project"
                        column="projectName"
                        currentSort={sortBy}
                        currentDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Total Runs"
                        column="totalRuns"
                        currentSort={sortBy}
                        currentDirection={sortDirection}
                        onSort={handleSort}
                        className="text-right"
                      />
                      <SortableHeader
                        label="Total Tests"
                        column="totalTests"
                        currentSort={sortBy}
                        currentDirection={sortDirection}
                        onSort={handleSort}
                        className="text-right"
                      />
                      <SortableHeader
                        label="Pass Rate"
                        column="passRate"
                        currentSort={sortBy}
                        currentDirection={sortDirection}
                        onSort={handleSort}
                        className="text-right"
                      />
                      <SortableHeader
                        label="Flaky Tests"
                        column="flakyTests"
                        currentSort={sortBy}
                        currentDirection={sortDirection}
                        onSort={handleSort}
                        className="text-right"
                      />
                      <SortableHeader
                        label="Avg Duration"
                        column="avgDurationMs"
                        currentSort={sortBy}
                        currentDirection={sortDirection}
                        onSort={handleSort}
                        className="text-right"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedData.map((project) => (
                      <tr key={project.projectId} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium">{project.projectName}</td>
                        <td className="py-3 pr-4 text-right">
                          {project.totalRuns.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {project.totalTests.toLocaleString()}
                        </td>
                        <td
                          className={`py-3 pr-4 text-right font-medium ${passRateColor(project.passRate)}`}
                        >
                          {project.passRate.toFixed(1)}%
                        </td>
                        <td className="py-3 pr-4 text-right">{project.flakyTests}</td>
                        <td className="py-3 pr-4 text-right">
                          {formatDurationMs(project.avgDurationMs)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
