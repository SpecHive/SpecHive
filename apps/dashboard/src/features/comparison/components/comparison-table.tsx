import { Sigma } from 'lucide-react';
import { useMemo } from 'react';

import { Sparkline } from '@/shared/components/charts';
import { HealthScoreBadge } from '@/shared/components/health-score-badge';
import { TrendIndicator } from '@/shared/components/trend-indicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { SortableHeader } from '@/shared/components/ui/sortable-header';
import { useSortable } from '@/shared/hooks/use-sortable';
import { formatDurationMs } from '@/shared/lib/formatters';
import type { ProjectComparisonItem, ProjectComparisonResponse } from '@/types/api';

interface ComparisonTableProps {
  projects: ProjectComparisonItem[];
  orgAverage: ProjectComparisonResponse['orgAverage'];
}

/** Returns green when project is better than org, red when worse. */
function passRateClass(value: number, orgValue: number): string {
  if (value > orgValue) return 'text-green-600';
  if (value < orgValue) return 'text-red-600';
  return '';
}

/** Lower is better for flaky/skip rate — invert the comparison. */
function lowerBetterClass(value: number, orgValue: number): string {
  if (value < orgValue) return 'text-green-600';
  if (value > orgValue) return 'text-red-600';
  return '';
}

export function ComparisonTable({ projects, orgAverage }: ComparisonTableProps) {
  const { sortBy, sortDirection, handleSort } = useSortable({
    defaultColumn: 'healthScore',
    defaultDirection: 'desc',
  });

  const sortedProjects = useMemo(() => {
    if (!sortBy || !sortDirection) return projects;

    return [...projects].sort((a, b) => {
      const aVal = a[sortBy as keyof ProjectComparisonItem];
      const bVal = b[sortBy as keyof ProjectComparisonItem];

      // Push nulls to end regardless of direction
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [projects, sortBy, sortDirection]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto max-h-[70vh]">
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
                  label="Health"
                  column="healthScore"
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
                />
                <th className="pb-3 pr-4">Trend</th>
                <SortableHeader
                  label="Flaky Rate"
                  column="flakyRate"
                  currentSort={sortBy}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Skip Rate"
                  column="skipRate"
                  currentSort={sortBy}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Avg Duration"
                  column="avgDurationMs"
                  currentSort={sortBy}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Retried"
                  column="retriedTests"
                  currentSort={sortBy}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Runs"
                  column="totalRuns"
                  currentSort={sortBy}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {sortedProjects.map((project) => (
                <tr key={project.projectId} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{project.projectName}</td>
                  <td className="py-3 pr-4 text-center">
                    <HealthScoreBadge score={project.healthScore} />
                  </td>
                  <td
                    className={`py-3 pr-4 ${passRateClass(project.passRate, orgAverage.passRate)}`}
                  >
                    <TrendIndicator
                      value={`${project.passRate.toFixed(1)}%`}
                      delta={project.passRateDelta}
                    />
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <Sparkline
                      data={project.dailyPassRates.map((d) => ({
                        date: d.date,
                        value: d.passRate,
                      }))}
                    />
                  </td>
                  <td
                    className={`py-3 pr-4 ${lowerBetterClass(project.flakyRate, orgAverage.flakyRate)}`}
                  >
                    <TrendIndicator
                      value={`${project.flakyRate.toFixed(1)}%`}
                      delta={project.flakyRateDelta}
                      positiveIsGood={false}
                    />
                  </td>
                  <td
                    className={`py-3 pr-4 ${lowerBetterClass(project.skipRate, orgAverage.skipRate)}`}
                  >
                    {project.skipRate.toFixed(1)}%
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      title={`min: ${formatDurationMs(project.minDurationMs ?? 0)} / max: ${formatDurationMs(project.maxDurationMs ?? 0)}`}
                    >
                      {formatDurationMs(project.avgDurationMs)}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{project.retriedTests.toLocaleString()}</td>
                  <td className="py-3 pr-4">{project.totalRuns.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="sticky bottom-0 z-10 border-t-2 border-border bg-card font-semibold shadow-[0_-2px_4px_rgba(0,0,0,0.06)]">
                <td className="bg-primary/10 py-3 pr-4">
                  <span className="inline-flex items-center gap-2">
                    <Sigma className="h-4 w-4 text-primary" />
                    <span>Org Average</span>
                  </span>
                </td>
                <td className="bg-primary/10 py-3 pr-4 text-center">
                  <HealthScoreBadge score={orgAverage.healthScore} />
                </td>
                <td className="bg-primary/10 py-3 pr-4">{orgAverage.passRate.toFixed(1)}%</td>
                <td className="bg-primary/10 py-3 pr-4 text-right">
                  <Sparkline
                    data={orgAverage.dailyPassRates.map((d) => ({
                      date: d.date,
                      value: d.passRate,
                    }))}
                  />
                </td>
                <td className="bg-primary/10 py-3 pr-4">{orgAverage.flakyRate.toFixed(1)}%</td>
                <td className="bg-primary/10 py-3 pr-4">{orgAverage.skipRate.toFixed(1)}%</td>
                <td className="bg-primary/10 py-3 pr-4">
                  {formatDurationMs(orgAverage.avgDurationMs)}
                </td>
                <td className="bg-primary/10 py-3 pr-4">
                  {orgAverage.retriedTests.toLocaleString()}
                </td>
                <td className="bg-primary/10 py-3 pr-4">{orgAverage.totalRuns.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
