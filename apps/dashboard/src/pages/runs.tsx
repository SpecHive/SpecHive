import { useNavigate, useSearchParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApi } from '@/hooks/use-api';
import { runStatusOptions, statusColorsDot } from '@/lib/constants';
import { formatDuration, formatRelativeTime, truncateId } from '@/lib/formatters';
import type { PaginatedResponse, Project, RunSummary } from '@/types/api';

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={`h-2 w-2 rounded-full ${statusColorsDot[status] || 'bg-gray-400'}`} />
      {status}
    </span>
  );
}

export function RunsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const projectId = searchParams.get('projectId') || '';
  const status = searchParams.get('status') || '';
  const page = searchParams.get('page') || '1';
  const pageSize = searchParams.get('pageSize') || '20';

  const { data: projectsData } = useApi<PaginatedResponse<Project>>('/v1/projects');

  const params: Record<string, string> = { page, pageSize };
  if (projectId) params.projectId = projectId;
  if (status) params.status = status;

  const effectiveProjectId = projectId || projectsData?.data[0]?.id || '';

  const { data: runsData, loading } = useApi<PaginatedResponse<RunSummary>>(
    effectiveProjectId ? '/v1/runs' : null,
    effectiveProjectId ? { ...params, projectId: effectiveProjectId } : undefined,
  );

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

  const projects = projectsData?.data || [];
  const runs = runsData?.data || [];
  const meta = runsData?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Test Runs</h1>
        <p className="mt-1 text-muted-foreground">Browse and filter test run results.</p>
      </div>

      <div className="flex gap-4">
        <select
          value={effectiveProjectId}
          onChange={(e) => updateParam('projectId', e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
          aria-label="Filter by project"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => updateParam('status', e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {runStatusOptions.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !runsData ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No runs found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Tests</th>
                    <th className="pb-3 pr-4">Duration</th>
                    <th className="pb-3">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      onClick={() => navigate(`/runs/${run.id}`)}
                      className="cursor-pointer border-b transition-colors hover:bg-accent"
                    >
                      <td className="py-3 pr-4">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className={`py-3 pr-4 ${run.name ? '' : 'font-mono text-xs'}`}>
                        {run.name ?? truncateId(run.id)}
                      </td>
                      <td className="py-3 pr-4">
                        {run.passedTests}/{run.totalTests}
                      </td>
                      <td className="py-3 pr-4">{formatDuration(run.startedAt, run.finishedAt)}</td>
                      <td className="py-3">{formatRelativeTime(run.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => updateParam('pageSize', e.target.value)}
                  className="rounded-md border bg-background px-2 py-1 text-sm"
                  aria-label="Page size"
                >
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => updateParam('page', String(meta.page - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => updateParam('page', String(meta.page + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
