import { CheckCircle, Clock, PlayCircle, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useApi } from '@/hooks/use-api';
import { computePassRate, formatDuration, formatRelativeTime } from '@/lib/formatters';
import type { PaginatedResponse, Project, RunSummary } from '@/types/api';

const statusColors: Record<string, string> = {
  passed: 'bg-green-500',
  failed: 'bg-destructive',
  running: 'bg-blue-500',
  pending: 'bg-gray-400',
  cancelled: 'bg-yellow-500',
};

function StatusDot({ status }: { status: string }) {
  return (
    <div
      className={`h-2 w-2 rounded-full ${statusColors[status] || 'bg-gray-400'}`}
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
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

  const projectId = selectedProjectId || projectsData?.data[0]?.id || null;

  const { data: runsData, loading: runsLoading } = useApi<PaginatedResponse<RunSummary>>(
    projectId ? '/v1/runs' : null,
    projectId ? { projectId, pageSize: '10' } : undefined,
  );

  const stats = useMemo(() => {
    if (!runsData) return null;

    const runs = runsData.data;
    const totalRuns = runsData.meta.total;

    const totalPassed = runs.reduce((sum, r) => sum + r.passedTests, 0);
    const totalTests = runs.reduce((sum, r) => sum + r.totalTests, 0);
    const passRate = computePassRate(totalPassed, totalTests);

    const failedTests = runs.reduce((sum, r) => sum + r.failedTests, 0);

    const durations = runs
      .filter((r) => r.startedAt && r.finishedAt)
      .map((r) => new Date(r.finishedAt!).getTime() - new Date(r.startedAt!).getTime());
    const avgMs =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const avgMin = Math.floor(avgMs / 60000);
    const avgSec = Math.floor((avgMs % 60000) / 1000);
    const avgDuration = avgMs > 0 ? `${avgMin}m ${avgSec}s` : '—';

    return { totalRuns, passRate, failedTests, avgDuration };
  }, [runsData]);

  const loading = projectsLoading || runsLoading;

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

      {stats && (
        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">
            Key metrics
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
                <PlayCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalRuns.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.passRate}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed Tests</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.failedTests}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Duration</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.avgDuration}</div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

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
                      <span className="font-medium">{run.status}</span>
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
