import { AlertTriangle, CheckCircle, Clock, PlayCircle, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { TooltipContentProps } from 'recharts/types/component/Tooltip';

import { LineChart, type LineChartLine } from '@/components/charts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useApi } from '@/hooks/use-api';
import { CHART_COLORS } from '@/lib/chart-colors';
import { statusColorsDot } from '@/lib/constants';
import {
  formatDateLabel,
  formatDuration,
  formatDurationMs,
  formatRelativeTime,
  truncateId,
} from '@/lib/formatters';
import type {
  DurationTrendPoint,
  FlakyTestSummary,
  PaginatedResponse,
  PassRateTrendPoint,
  Project,
  ProjectAnalyticsSummary,
  RunSummary,
} from '@/types/api';

const PERIOD_OPTIONS = [7, 14, 30] as const;

const PASS_RATE_LINES: LineChartLine[] = [
  { key: 'passRate', label: 'Pass Rate', color: CHART_COLORS.pass },
];

const DURATION_LINES: LineChartLine[] = [
  { key: 'avgDurationMs', label: 'Avg', color: CHART_COLORS.primary },
  { key: 'minDurationMs', label: 'Min', color: CHART_COLORS.pass, dashed: true },
  { key: 'maxDurationMs', label: 'Max', color: CHART_COLORS.fail, dashed: true },
];

function PassRateTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as PassRateTrendPoint | undefined;
  if (!point) return null;

  return (
    <div className="rounded-md border bg-background p-3 text-sm shadow-md">
      <p className="font-medium">{formatDateLabel(String(label))}</p>
      <p className="text-green-500">Pass Rate: {point.passRate.toFixed(1)}%</p>
      <p className="text-muted-foreground">Total: {point.totalTests}</p>
      <p className="text-muted-foreground">Passed: {point.passedTests}</p>
      <p className="text-muted-foreground">Failed: {point.failedTests}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <div
      className={`h-2 w-2 rounded-full ${statusColorsDot[status] || 'bg-gray-400'}`}
      aria-label={status}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border bg-muted" />
    </div>
  );
}

export function DashboardPage() {
  const { data: projectsData, loading: projectsLoading } =
    useApi<PaginatedResponse<Project>>('/v1/projects');

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [trendDays, setTrendDays] = useState<number>(30);

  const projectId = selectedProjectId || projectsData?.data[0]?.id || null;

  const { data: runsData, loading: runsLoading } = useApi<PaginatedResponse<RunSummary>>(
    projectId ? '/v1/runs' : null,
    projectId ? { projectId, pageSize: '10' } : undefined,
  );

  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
  } = useApi<ProjectAnalyticsSummary>(
    projectId ? `/v1/projects/${projectId}/analytics/summary` : null,
    projectId ? { days: String(trendDays) } : undefined,
  );

  const { data: passRateTrend, loading: trendLoading } = useApi<PassRateTrendPoint[]>(
    projectId ? `/v1/projects/${projectId}/analytics/pass-rate-trend` : null,
    projectId ? { days: String(trendDays) } : undefined,
  );

  const { data: durationTrend, loading: durationLoading } = useApi<DurationTrendPoint[]>(
    projectId ? `/v1/projects/${projectId}/analytics/duration-trend` : null,
    projectId ? { days: String(trendDays) } : undefined,
  );

  const { data: flakyTests, loading: flakyLoading } = useApi<FlakyTestSummary[]>(
    projectId ? `/v1/projects/${projectId}/analytics/flaky-tests` : null,
    projectId ? { days: String(trendDays), limit: '10' } : undefined,
  );

  const loading = projectsLoading || runsLoading || summaryLoading;

  if (loading && !runsData) {
    return <LoadingSkeleton />;
  }

  const projects = projectsData?.data || [];
  const runs = runsData?.data || [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Overview of your test suite health and recent activity.
          </p>
        </div>
        {projects.length > 1 && (
          <select
            value={projectId || ''}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
            aria-label="Select project"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {summaryError && <p className="text-sm text-destructive">Failed to load analytics data</p>}

      {summaryLoading && !summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
      ) : (
        summary && (
          <section aria-labelledby="stats-heading">
            <h2 id="stats-heading" className="sr-only">
              Key metrics
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
                  <PlayCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.totalRuns.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.passRate.toFixed(1)}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed Tests</CardTitle>
                  <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.failedTests}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Duration</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatDurationMs(summary.avgDurationMs)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Flaky Tests</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.flakyTests}</div>
                </CardContent>
              </Card>
            </div>
          </section>
        )
      )}

      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Period:</span>
        {PERIOD_OPTIONS.map((days) => (
          <Button
            key={days}
            variant={trendDays === days ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTrendDays(days)}
            aria-pressed={trendDays === days}
          >
            {days}d
          </Button>
        ))}
      </div>

      {/* Pass Rate Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Pass Rate Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <div className="h-[300px] animate-pulse rounded bg-muted" />
          ) : passRateTrend && passRateTrend.length > 0 ? (
            <LineChart
              data={passRateTrend}
              xKey="date"
              lines={PASS_RATE_LINES}
              xFormatter={formatDateLabel}
              yDomain={[0, 100]}
              yFormatter={(v) => `${v}%`}
              tooltipContent={PassRateTooltip}
              ariaLabel="Pass rate trend over time"
            />
          ) : (
            <p className="py-12 text-center text-muted-foreground">No data for this period</p>
          )}
        </CardContent>
      </Card>

      {/* Duration Trend + Flaky Tests */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Duration Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {durationLoading ? (
              <div className="h-[300px] animate-pulse rounded bg-muted" />
            ) : durationTrend && durationTrend.length > 0 ? (
              <LineChart
                data={durationTrend}
                xKey="date"
                lines={DURATION_LINES}
                xFormatter={formatDateLabel}
                yFormatter={formatDurationMs}
                ariaLabel="Test duration trend over time"
              />
            ) : (
              <p className="py-12 text-center text-muted-foreground">No data for this period</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Flaky Tests</CardTitle>
          </CardHeader>
          <CardContent>
            {flakyLoading ? (
              <div className="h-[300px] animate-pulse rounded bg-muted" />
            ) : flakyTests && flakyTests.length > 0 ? (
              <div className="space-y-3">
                {flakyTests.map((test) => (
                  <div
                    key={test.testName}
                    className="flex items-center justify-between rounded-md border p-3 text-sm"
                  >
                    <span className="mr-4 truncate font-medium">{test.testName}</span>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        {test.flakyCount} flaky
                      </span>
                      <span className="text-muted-foreground">
                        {(test.totalRuns > 0
                          ? (test.flakyCount / test.totalRuns) * 100
                          : 0
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <CheckCircle className="h-8 w-8" />
                <p>No flaky tests detected</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Runs */}
      <section aria-labelledby="recent-runs-heading">
        <Card>
          <CardHeader>
            <CardTitle id="recent-runs-heading">Recent Runs</CardTitle>
            <CardDescription>
              {runs.length > 0 ? `Last ${runs.length} test runs` : 'No runs yet'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No test runs found. Push some test results to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {runs.map((run) => (
                  <Link
                    key={run.id}
                    to={`/runs/${run.id}`}
                    className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <StatusDot status={run.status} />
                      <span className={`font-medium ${run.name ? '' : 'font-mono text-xs'}`}>
                        {run.name ?? truncateId(run.id)}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-muted-foreground">
                      <span>
                        {run.passedTests} / {run.totalTests} passed
                      </span>
                      <span>{formatDuration(run.startedAt, run.finishedAt)}</span>
                      <span>{formatRelativeTime(run.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
